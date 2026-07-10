import { scrapeMatchData } from "../services/scraperService.js";
import { callAIModel, parseAIResponse } from "../services/aiService.js";
import {
  createPrediction,
  getPredictionsByUserId,
  deletePrediction
} from "../models/predModel.js";

/**
 * Endpoint de traitement d'un match (Scraping -> IA -> Parsing -> Persistence).
 */
import { logError } from "../services/logger.js";

/**
 * Endpoint de traitement d'un match (Scraping -> IA -> Parsing -> Persistence).
 * Supporte le mode synchrone standard et le mode streaming en temps réel (NDJSON).
 */
export async function analyzeMatch(req, res) {
  const matchUrl = req.body.matchUrl || req.body.url;
  const userId = req.user.id; // injecté par authMiddleware.js
  const isStream = req.body.stream === true;

  if (!matchUrl) {
    if (isStream) {
      res.setHeader("Content-Type", "application/x-ndjson");
      res.write(JSON.stringify({ type: "error", message: "L'URL du match est requise." }) + "\n");
      return res.end();
    }
    return res.status(400).json({ error: "L'URL du match est requise." });
  }

  if (!matchUrl.includes("365scores.com")) {
    if (isStream) {
      res.setHeader("Content-Type", "application/x-ndjson");
      res.write(JSON.stringify({ type: "error", message: "URL invalide. Seules les URLs 365Scores sont supportées." }) + "\n");
      return res.end();
    }
    return res.status(400).json({ error: "URL invalide. Seules les URLs 365Scores sont supportées." });
  }

  if (isStream) {
    // Mode streaming en temps réel (NDJSON)
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const sendProgress = (type, data) => {
      res.write(JSON.stringify({ type, ...data }) + "\n");
    };

    try {
      console.log(`[predController.js] Début de l'analyse en streaming pour l'utilisateur ${userId} sur : ${matchUrl}`);

      sendProgress("status", { step: "scraping", message: "On récupère les statistiques de forme du match sur 365Scores..." });
      const scrapedText = await scrapeMatchData(matchUrl);

      sendProgress("status", { step: "ai", message: "On calcule les probabilités de score et on projette les résultats..." });
      const rawAiText = await callAIModel(scrapedText);

      sendProgress("status", { step: "parsing", message: "On valide et on formate la modélisation statistique..." });
      const predictionData = parseAIResponse(rawAiText);

      sendProgress("status", { step: "saving", message: "On enregistre l'analyse dans votre tableau de bord..." });
      const savedPrediction = await createPrediction(
        userId,
        matchUrl,
        predictionData.equipe_domicile,
        predictionData.equipe_exterieur,
        predictionData
      );

      sendProgress("result", { prediction: savedPrediction });
      res.end();
    } catch (error) {
      await logError(`Erreur lors de l'analyse en streaming pour l'utilisateur ${userId} sur ${matchUrl}`, error);

      // Classification intelligente des erreurs
      let friendlyMessage = "Une erreur inattendue est survenue.";
      const errMsg = error.message || "";
      if (errMsg.includes("GEMINI_API_KEY") || errMsg.includes("Clé d'API") || errMsg.includes("GoogleGenAI")) {
        friendlyMessage = "Le service d'analyse de l'IA (Gemini) n'est pas disponible pour le moment. Veuillez vérifier la configuration de l'API.";
      } else if (errMsg.includes("timeout") || errMsg.includes("playwright") || errMsg.includes("navigu") || errMsg.includes("365scores")) {
        friendlyMessage = "Nous n'avons pas pu récupérer les données de ce match sur 365Scores. Vérifiez l'adresse ou réessayez.";
      } else if (errMsg.includes("validation") || errMsg.includes("parsing") || errMsg.includes("Zod")) {
        friendlyMessage = "Le rapport généré n'a pas pu être validé. On retente l'analyse.";
      } else {
        friendlyMessage = `Erreur lors de l'analyse : ${error.message}`;
      }

      sendProgress("error", { message: friendlyMessage });
      res.end();
    }
  } else {
    // Mode synchrone classique (conservé pour rétrocompatibilité)
    try {
      console.log(`[predController.js] Début de l'analyse synchrone pour l'utilisateur ${userId} sur : ${matchUrl}`);

      const scrapedText = await scrapeMatchData(matchUrl);
      const rawAiText = await callAIModel(scrapedText);
      const predictionData = parseAIResponse(rawAiText);

      const savedPrediction = await createPrediction(
        userId,
        matchUrl,
        predictionData.equipe_domicile,
        predictionData.equipe_exterieur,
        predictionData
      );

      return res.status(200).json(savedPrediction);
    } catch (error) {
      await logError(`Erreur lors de l'analyse synchrone pour l'utilisateur ${userId} sur ${matchUrl}`, error);

      let friendlyMessage = "Erreur interne lors de l'analyse.";
      const errMsg = error.message || "";
      if (errMsg.includes("GEMINI_API_KEY") || errMsg.includes("Clé d'API") || errMsg.includes("GoogleGenAI")) {
        friendlyMessage = "Le service d'analyse de l'IA (Gemini) n'est pas disponible pour le moment. Veuillez vérifier la configuration de l'API.";
      } else if (errMsg.includes("timeout") || errMsg.includes("playwright") || errMsg.includes("navigu") || errMsg.includes("365scores")) {
        friendlyMessage = "Nous n'avons pas pu récupérer les données de ce match sur 365Scores. Vérifiez l'adresse ou réessayez.";
      } else if (errMsg.includes("validation") || errMsg.includes("parsing") || errMsg.includes("Zod")) {
        friendlyMessage = "Le rapport généré n'a pas pu être validé. On retente l'analyse.";
      } else {
        friendlyMessage = `Erreur interne lors de l'analyse : ${error.message}`;
      }

      return res.status(500).json({ error: friendlyMessage });
    }
  }
}

/**
 * Récupère l'historique complet des prédictions de l'utilisateur.
 */
export async function getHistory(req, res) {
  const userId = req.user.id;
  try {
    const history = await getPredictionsByUserId(userId);
    return res.status(200).json(history);
  } catch (error) {
    console.error("[predController.js] Erreur getHistory :", error.message);
    return res.status(500).json({ error: "Erreur interne lors de la récupération de l'historique." });
  }
}

/**
 * Supprime une prédiction spécifique de l'historique de l'utilisateur.
 */
export async function deleteHistoryItem(req, res) {
  const userId = req.user.id;
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "L'identifiant de la prédiction est requis." });
  }

  try {
    const deleted = await deletePrediction(parseInt(id), userId);
    if (!deleted) {
      return res.status(404).json({ error: "Prédiction non trouvée ou non autorisée." });
    }
    return res.status(200).json({ message: "Prédiction supprimée avec succès de l'historique." });
  } catch (error) {
    console.error("[predController.js] Erreur deleteHistoryItem :", error.message);
    return res.status(500).json({ error: "Erreur interne lors de la suppression de la prédiction." });
  }
}
