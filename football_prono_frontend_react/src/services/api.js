const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

/**
 * Service HTTP générique pour centraliser les appels API avec gestion des tokens JWT.
 */
async function request(endpoint, options = {}) {
  const token = localStorage.getItem("token");
  
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const config = {
    ...options,
    headers,
  };
  
  // Implémentation d'un timeout par défaut (ex: 20 secondes, utile pour le scraping lourd)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  config.signal = controller.signal;
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    clearTimeout(timeoutId);
    
    let data;
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    
    if (!response.ok) {
      const msg = data.message || data.error || "";
      if (response.status === 409 || msg.includes("déjà enregistré") || msg.includes("déjà inscrit")) {
        throw new Error("Cette adresse email est déjà enregistrée. Veuillez vous connecter ou utiliser une autre adresse.");
      }
      if (response.status === 401 || msg.includes("invalides") || msg.includes("incorrect")) {
        throw new Error("Le mot de passe saisi ou l'email est incorrect. Veuillez réessayer.");
      }
      if (response.status === 400 || msg.includes("validation")) {
        throw new Error("Les données saisies sont invalides. Veuillez vérifier le format de votre adresse email (ex: nom@domaine.com) et saisir un mot de passe de 6 caractères minimum.");
      }
      throw new Error(msg || "Une erreur de connexion est survenue. Nous en sommes désolés, c'est de notre faute. Veuillez réessayer dans quelques instants.");
    }
    
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("La requête a expiré (Timeout). Le traitement du match par l'IA a pris trop de temps.");
    }
    // Conserver les erreurs déjà formatées
    if (error.message) {
      throw error;
    }
    // Erreur réseau générique
    throw new Error("Une erreur de connexion est survenue. Nous en sommes désolés, c'est de notre faute. Veuillez réessayer dans quelques instants.");
  }
}

export const apiService = {
  // Authentification
  login: (username, password) => {
    return request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: username, password }),
    });
  },
  
  register: (username, password) => {
    return request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: username, password }),
    });
  },
  
  getProfile: () => {
    return request("/api/auth/profile", {
      method: "GET",
    });
  },
  
  // Analyses / Prédictions
  analyzeMatch: (matchUrl) => {
    return request("/api/predictions/analyser", {
      method: "POST",
      body: JSON.stringify({ matchUrl }),
    });
  },

  analyzeMatchStream: async (matchUrl, onProgress, onResult, onError) => {
    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json"
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/predictions/analyser`, {
        method: "POST",
        headers,
        body: JSON.stringify({ matchUrl, stream: true })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || "Une erreur réseau est survenue.");
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // Conserver la dernière ligne potentiellement incomplète dans le buffer
        
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === "status") {
              onProgress(data);
            } else if (data.type === "result") {
              onResult(data.prediction);
            } else if (data.type === "error") {
              onError(new Error(data.message));
            }
          } catch {
            console.error("Erreur parsing ligne stream :", e, line);
          }
        }
      }
    } catch (error) {
      onError(error);
    }
  },
  
  getHistory: () => {
    return request("/api/predictions/history", {
      method: "GET",
    });
  },
  
  deleteHistoryItem: (id) => {
    return request(`/api/predictions/history/${id}`, {
      method: "DELETE",
    });
  }
};
