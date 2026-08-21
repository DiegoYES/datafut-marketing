const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('--- STARTING DATAFUT EXPLORATION ---');
  const browser = await chromium.launch({
    headless: true
  });

  const sessionPath = path.join(__dirname, 'datafut-session.json');
  console.log('Loading session state from:', sessionPath);

  const context = await browser.newContext({
    storageState: fs.existsSync(sessionPath) ? sessionPath : undefined,
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  // 1. Confirm session & navigate home
  console.log('Navigating to https://data-fut.com...');
  await page.goto('https://data-fut.com', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const currentUrl = page.url();
  const pageTitle = await page.title();
  console.log('Initial Page URL:', currentUrl);
  console.log('Initial Page Title:', pageTitle);

  // Take screenshot of home
  await page.screenshot({ path: path.join(__dirname, 'step1_home.png'), fullPage: true });

  // Check cookies / localStorage for auth evidence
  const cookies = await context.cookies();
  const tokenCookie = cookies.find(c => c.name === 'token');
  console.log('Token Cookie present:', !!tokenCookie);
  if (tokenCookie) {
    console.log('Token Domain:', tokenCookie.domain, 'Expires:', new Date(tokenCookie.expires * 1000).toISOString());
  }

  // Look for session elements in DOM
  const sessionInfo = await page.evaluate(() => {
    const userElements = [];
    // Search for profile, user menu, avatar, name, logout buttons, etc.
    const selectors = [
      '[class*="user"]', '[class*="profile"]', '[class*="avatar"]',
      '[class*="admin"]', '[href*="profile"]', '[href*="admin"]',
      'button', 'a'
    ];
    
    // Find text containing indicators
    const allLinks = Array.from(document.querySelectorAll('a, button, div, span'));
    const loginTextMatches = allLinks.filter(el => {
      const txt = (el.innerText || '').toLowerCase();
      return txt.includes('perfil') || txt.includes('admin') || txt.includes('cuenta') || txt.includes('cerrar sesión') || txt.includes('logout');
    }).map(el => ({ tag: el.tagName, text: el.innerText.trim().slice(0, 50), href: el.getAttribute('href') }));

    return {
      bodyTextLength: document.body.innerText.length,
      loginTextMatches: loginTextMatches.slice(0, 10)
    };
  });

  console.log('Session DOM findings:', JSON.stringify(sessionInfo, null, 2));

  // 2. Scroll through home page
  console.log('Scrolling through main page...');
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight || totalHeight > 3000) {
          clearInterval(timer);
          resolve();
        }
      }, 150);
    });
  });
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, 0));

  // Extract structure of home page
  const homeStructure = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => h.innerText.trim());
    const navLinks = Array.from(document.querySelectorAll('nav a, header a')).map(a => ({ text: a.innerText.trim(), href: a.getAttribute('href') }));
    
    // Find matches cards or clickable match links
    const links = Array.from(document.querySelectorAll('a'));
    const matchLinks = links
      .filter(a => {
        const href = a.getAttribute('href') || '';
        return href.includes('partido') || href.includes('match') || href.includes('game') || href.includes('/m/');
      })
      .map(a => ({ text: a.innerText.trim().replace(/\n+/g, ' '), href: a.getAttribute('href') }));

    // Also look for match containers/cards if links aren't explicitly href'd
    const cardElements = Array.from(document.querySelectorAll('[class*="match"], [class*="partido"], [class*="card"], [class*="fixture"]'))
      .map(el => ({
        class: el.className,
        text: el.innerText.trim().slice(0, 100).replace(/\n+/g, ' ')
      })).slice(0, 15);

    return {
      headings,
      navLinks: navLinks.slice(0, 15),
      matchLinks,
      cardElements
    };
  });

  console.log('Home Structure Headings:', homeStructure.headings);
  console.log('Nav Links:', homeStructure.navLinks);
  console.log('Match Links Found:', homeStructure.matchLinks);
  console.log('Card Sample:', homeStructure.cardElements.slice(0, 5));

  // 3. Open an available match
  let targetMatchUrl = null;
  if (homeStructure.matchLinks.length > 0) {
    targetMatchUrl = homeStructure.matchLinks[0].href;
  } else {
    // Search DOM broadly for match elements or click first interactive match item
    const possibleMatchHref = await page.evaluate(() => {
      const allAnchors = Array.from(document.querySelectorAll('a[href]'));
      for (const a of allAnchors) {
        const href = a.getAttribute('href');
        if (href && href !== '#' && href !== '/' && !href.includes('javascript') && !href.includes('login') && !href.includes('register')) {
          if (/\d+/.test(href) || href.includes('vs') || href.includes('partido') || href.includes('league') || href.includes('liga')) {
            return href;
          }
        }
      }
      return null;
    });
    if (possibleMatchHref) {
      targetMatchUrl = possibleMatchHref;
    }
  }

  console.log('Target match URL identified:', targetMatchUrl);

  if (targetMatchUrl) {
    const fullUrl = targetMatchUrl.startsWith('http') ? targetMatchUrl : new URL(targetMatchUrl, 'https://data-fut.com').href;
    console.log('Navigating to match URL:', fullUrl);
    await page.goto(fullUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
  } else {
    console.log('No explicit match link found. Looking for clickable match card elements on home page...');
    // Try clicking first card element if available
    const clicked = await page.evaluate(() => {
      const matchCard = document.querySelector('[class*="match"], [class*="partido"], [class*="game"]');
      if (matchCard) {
        matchCard.click();
        return true;
      }
      return false;
    });
    if (clicked) {
      await page.waitForTimeout(3000);
    }
  }

  const matchPageUrl = page.url();
  const matchPageTitle = await page.title();
  console.log('Match Page URL:', matchPageUrl);
  console.log('Match Page Title:', matchPageTitle);

  await page.screenshot({ path: path.join(__dirname, 'step2_match.png'), fullPage: true });

  // Extract match page elements
  const matchPageDetails = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => h.innerText.trim());
    const tabs = Array.from(document.querySelectorAll('button, a, div[role="tab"]'))
      .filter(el => {
        const txt = el.innerText.trim().toLowerCase();
        return txt.length > 0 && txt.length < 30;
      })
      .map(el => ({ tag: el.tagName, text: el.innerText.trim(), href: el.getAttribute('href') }));

    const mainContentSnippet = document.body.innerText.slice(0, 1500).replace(/\n+/g, ' | ');

    return {
      headings,
      tabs: tabs.slice(0, 20),
      mainContentSnippet
    };
  });

  console.log('Match Page Headings:', matchPageDetails.headings);
  console.log('Match Page Tabs/Buttons:', matchPageDetails.tabs);

  // 4. Check for Predictions / Predicciones section
  console.log('Checking for predictions section...');
  const predictionElementInfo = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('a, button, div, span, li'));
    const predMatch = elements.find(el => {
      const txt = (el.innerText || '').toLowerCase();
      return (txt.includes('predicci') || txt.includes('pronostico') || txt.includes('prediction') || txt.includes('ia') || txt.includes('probabilidad')) && el.children.length === 0;
    });

    if (predMatch) {
      return {
        found: true,
        text: predMatch.innerText,
        tag: predMatch.tagName,
        parentTag: predMatch.parentElement ? predMatch.parentElement.tagName : null,
        href: predMatch.getAttribute('href') || (predMatch.parentElement ? predMatch.parentElement.getAttribute('href') : null)
      };
    }
    return { found: false };
  });

  console.log('Predictions element search result:', predictionElementInfo);

  if (predictionElementInfo.found) {
    console.log('Clicking on predictions element / tab...');
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, button, div, span, li'));
      const predMatch = elements.find(el => {
        const txt = (el.innerText || '').toLowerCase();
        return (txt.includes('predicci') || txt.includes('pronostico') || txt.includes('prediction') || txt.includes('ia') || txt.includes('probabilidad')) && el.children.length === 0;
      });
      if (predMatch) {
        predMatch.click();
      }
    });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(__dirname, 'step3_predictions.png'), fullPage: true });

    const predContent = await page.evaluate(() => {
      return {
        url: window.location.href,
        headings: Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => h.innerText.trim()),
        snippet: document.body.innerText.slice(0, 2000).replace(/\n+/g, ' | ')
      };
    });
    console.log('Predictions Page Details:', predContent);
  } else {
    console.log('Checking page text directly for any embedded predictions data...');
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasPredictionKeywords = /predicci|pron|probabilidad|win %|victoria|empate|ia/i.test(pageText);
    console.log('Page text contains prediction keywords:', hasPredictionKeywords);
  }

  console.log('--- EXPLORATION COMPLETED SUCCESSFULLY ---');
  await browser.close();
})();
