import React, { useState, useEffect } from 'react';
import { getTeamLogo } from '../utils/teamLogoResolver';

export default function TeamLogo({ teamName, size = 60, style = {}, alt = '' }) {
  const [logo, setLogo] = useState('');

  useEffect(() => {
    let isMounted = true;
    
    const resolveLogo = async () => {
      // 1. Dictionnaire statique (synchrone)
      let url = getTeamLogo(teamName);
      
      if (url.includes('ui-avatars.com') && teamName) {
        if (isMounted) setLogo(url); // Afficher le placeholder pendant le chargement
        
        try {
          // Requête TheSportsDB pour chercher l'équipe de manière robuste
          const searchQuery = encodeURIComponent(teamName);
          const searchRes = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${searchQuery}`);
          const searchData = await searchRes.json();
          
          if (searchData?.teams?.length > 0) {
            // Parcourir les équipes pour trouver le premier badge valide
            const team = searchData.teams.find(t => t.strBadge);
            if (team && team.strBadge) {
              url = team.strBadge;
            }
          }
        } catch (e) {
          console.error("Erreur résolution logo TheSportsDB pour", teamName, e);
        }
      }
      
      if (isMounted) setLogo(url);
    };
    
    resolveLogo();
    
    return () => {
      isMounted = false;
    };
  }, [teamName]);

  return (
    <img 
      src={logo} 
      alt={alt || teamName} 
      style={{ width: `${size}px`, height: `${size}px`, objectFit: "contain", ...style }} 
    />
  );
}
