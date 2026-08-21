// Strict Scope Classifier & Matcher for PlayDoIt <-> DataFut
function classifyPlayDoItMarket(marketName, homeTeam, awayTeam) {
  const mLow = marketName.toLowerCase().trim();
  const hLow = homeTeam.toLowerCase().trim();
  const aLow = awayTeam.toLowerCase().trim();

  let scope = 'match';
  let subject = 'match';

  // Check if market explicitly names the home team
  if (mLow.includes(hLow) || mLow.includes('local')) {
    scope = 'team';
    subject = 'home';
  } 
  // Check if market explicitly names the away team
  else if (mLow.includes(aLow) || mLow.includes('visitante')) {
    scope = 'team';
    subject = 'away';
  }

  return { scope, subject };
}

function matchPickStrict(datafutPick, playdoitMarket, homeTeam, awayTeam) {
  const pdScope = classifyPlayDoItMarket(playdoitMarket.name, homeTeam, awayTeam);
  
  // Rule 1: Scope MUST match exactly
  if (datafutPick.scope === 'match' && pdScope.scope !== 'match') {
    return { match: false, reason: `SCOPE_MISMATCH: DataFut solicitó partido completo, pero mercado PlayDoIt '${playdoitMarket.name}' es de equipo (${pdScope.subject}).` };
  }

  if (datafutPick.scope === 'team') {
    if (pdScope.scope !== 'team') {
      return { match: false, reason: `SCOPE_MISMATCH: DataFut solicitó equipo individual (${datafutPick.subject}), pero mercado PlayDoIt '${playdoitMarket.name}' es de partido completo.` };
    }
    const expectedSubject = datafutPick.subject.toLowerCase().includes(hLow) ? 'home' : 'away';
    if (pdScope.subject !== expectedSubject) {
      return { match: false, reason: `TEAM_MISMATCH: DataFut solicitó ${datafutPick.subject}, pero mercado PlayDoIt '${playdoitMarket.name}' es del rival.` };
    }
  }

  return { match: true };
}

module.exports = { classifyPlayDoItMarket, matchPickStrict };
