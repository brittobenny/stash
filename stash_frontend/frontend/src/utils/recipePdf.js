const escapeHtml = (value) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const buildIngredientList = (recipe) => {
    const statusItems = Array.isArray(recipe?.ingredient_status) ? recipe.ingredient_status : [];
    if (statusItems.length > 0) {
        return statusItems
            .filter((item) => (item?.name || '').trim())
            .map((item) => `<li>${escapeHtml(item.name)}: ${escapeHtml(item.display || `${item.needed_g || 0} g`)}</li>`)
            .join('');
    }

    const parsedItems = Array.isArray(recipe?.parsed_ingredients) ? recipe.parsed_ingredients : [];
    return parsedItems
        .filter((item) => (item?.name || '').trim())
        .map((item) => `<li>${escapeHtml(item.name)}: ${escapeHtml(item.display || `${item.grams || 0} g`)}</li>`)
        .join('');
};

export const downloadRecipePdf = (recipe) => {
    if (!recipe) return false;

    const steps = Array.isArray(recipe.steps) ? recipe.steps.filter((step) => String(step || '').trim()) : [];
    const ingredientMarkup = buildIngredientList(recipe);
    const nutrition = recipe.nutrition || {};
    const doodleSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'>
  <g stroke='#f3b9b9' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round' opacity='0.7'>
    <circle cx='26' cy='30' r='6'/>
    <line x1='26' y1='36' x2='26' y2='64'/>
    <line x1='90' y1='18' x2='90' y2='64'/>
    <line x1='82' y1='18' x2='82' y2='34'/>
    <line x1='98' y1='18' x2='98' y2='34'/>
    <path d='M120 40c-10 2-16 10-12 20 8 2 18-4 20-14-2-4-4-6-8-6z'/>
    <circle cx='54' cy='108' r='7'/>
    <path d='M48 120c10 8 22 8 32 0'/>
  </g>
</svg>`;
    const doodleBg = `data:image/svg+xml;utf8,${encodeURIComponent(doodleSvg)}`;
    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(recipe.name || 'Recipe')} - Recipe</title>
  <style>
    :root { --accent: #e11d2e; --ink: #1b1b1b; --muted: #6b6b6b; --paper: #fff7f2; --card: #ffffff; }
    * { box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: var(--ink); margin: 0; padding: 28px; background: var(--paper); background-image: url("${doodleBg}"); background-size: 160px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { background: var(--card); border-radius: 18px; padding: 24px; border: 1px solid #f0e6e0; box-shadow: 0 10px 20px rgba(0,0,0,0.08); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #f0e6e0; padding-bottom: 16px; margin-bottom: 20px; }
    .title { font-size: 28px; margin: 0; }
    .meta { color: var(--muted); margin-top: 6px; }
    .badge { display: inline-block; background: var(--accent); color: #fff; padding: 4px 10px; border-radius: 999px; font-size: 12px; margin-top: 10px; letter-spacing: 0.08em; }
    .doodle { width: 64px; height: 64px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { border: 1px solid #f0e6e0; border-radius: 14px; padding: 14px; background: #fffaf6; }
    h3 { margin: 0 0 10px; font-size: 16px; }
    ul, ol { padding-left: 18px; margin: 0; }
    li { margin-bottom: 8px; }
    .steps { margin-top: 16px; }
    .footer { margin-top: 18px; color: var(--muted); font-size: 12px; text-align: right; }
    @media print {
      body { padding: 20px; }
      .card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <h1 class="title">${escapeHtml(recipe.name || 'Recipe')}</h1>
        <div class="meta">${escapeHtml(recipe.cuisine || 'General')} | ${escapeHtml(recipe.difficulty || 'Standard')} | ${escapeHtml(recipe.minutes || 0)} mins</div>
        <div class="badge">STASH RECIPE</div>
      </div>
      <svg class="doodle" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <g stroke="#e11d2e" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.8">
          <circle cx="18" cy="18" r="6"/>
          <line x1="18" y1="24" x2="18" y2="48"/>
          <line x1="40" y1="12" x2="40" y2="48"/>
          <line x1="34" y1="12" x2="34" y2="28"/>
          <line x1="46" y1="12" x2="46" y2="28"/>
          <path d="M16 52c10 6 22 6 32 0"/>
        </g>
      </svg>
    </div>
    <div class="grid">
      <div class="card">
        <h3>Ingredients</h3>
        <ul>${ingredientMarkup || '<li>No ingredient details available.</li>'}</ul>
      </div>
      <div class="card">
        <h3>Nutrition</h3>
        <ul>
          <li>Calories: ${Math.round(Number(nutrition.calories || 0))} kcal</li>
          <li>Protein: ${Math.round(Number(nutrition.protein || 0))} g</li>
          <li>Carbs: ${Math.round(Number(nutrition.carbs || 0))} g</li>
          <li>Fat: ${Math.round(Number(nutrition.fat || 0))} g</li>
        </ul>
      </div>
    </div>
    <div class="card steps">
      <h3>Steps</h3>
      <ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('') || '<li>No preparation steps available.</li>'}</ol>
    </div>
    <div class="footer">Generated from Stash | Save as PDF from the print dialog</div>
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) return false;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
        win.print();
    }, 500);
    return true;
};
