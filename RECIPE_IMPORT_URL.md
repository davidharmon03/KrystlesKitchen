# Recipe Import from URL

Implemented ability to import recipes by pasting a URL from recipe websites.

## Overview

Users can paste a recipe URL from AllRecipes, Food Network, Serious Eats, or any site with recipe schema markup. The app parses the structured data and pre-fills a recipe for review and editing.

## What Was Added

### 1. Backend Endpoint: `POST /api/recipes/import-url`
- **Location:** `server/routes/recipes.js`
- **Input:** `{ url: string }`
- **Output:** Parsed recipe object with title, description, ingredients, steps, servings

**How it works:**
1. Fetches the URL with a User-Agent header (some sites block headless requests)
2. Parses `<script type="application/ld+json">` blocks
3. Searches for `@type: "Recipe"` in JSON-LD (handles @graph structures)
4. Extracts recipe fields:
   - `name` → title
   - `description` → description
   - `recipeIngredient` → ingredients (array)
   - `recipeInstructions` → steps (handles strings, objects, arrays)
   - `recipeYield` → servings count
5. Returns parsed recipe for frontend preview

**Error handling:**
- Network errors: "Failed to fetch URL"
- No recipe found: "No recipe found on this page. Try a different URL."
- Malformed JSON: Gracefully continues searching

### 2. Frontend: `ImportRecipeModal` Component
- **Location:** `client/src/components/ImportRecipeModal.jsx`
- **Two-step workflow:**
  1. **Step 1 - URL Input:** User pastes recipe URL
  2. **Step 2 - Preview & Edit:** Review parsed data, edit any field, save

**Features:**
- URL validation
- Loading spinner during fetch
- Error messages with retry
- Full recipe editor (matching manual recipe creation):
  - Title, description, servings
  - Ingredients (textarea, one per line)
  - Steps (textarea, one per line)
  - Recipe tags (healthy, organic, vegan, etc.)
  - Skill tags (vacuum seal, flash freeze, etc.)
  - Public/private toggle
- Back button to try another URL
- Save button with validation

### 3. Kitchen Page Integration
- **Location:** `client/src/pages/Kitchen.jsx`
- **Import button:** Added to header next to "New Recipe" button
- **Icon:** Download icon (📥)
- **Flow:** Click Import → Enter URL → Review → Save

## Supported Recipe Sites

✅ **Works well:**
- AllRecipes.com
- Food Network (foodnetwork.com)
- Serious Eats (seriouseats.com)
- Simply Recipes (simplyrecipes.com)
- Bon Appétit (bonappetit.com)
- Tasty (tasty.co)
- Better Homes & Gardens (bhg.com)
- *Any site with schema.org/Recipe markup*

⚠️ **May need workaround:**
- NYT Cooking (nytimes.com/recipes) - may block server-side requests

❌ **Won't work:**
- Sites without recipe schema markup
- JavaScript-rendered-only content
- Sites with aggressive bot detection

## Technical Details

### JSON-LD Format
The endpoint looks for this structure in `<script type="application/ld+json">`:

```json
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Chocolate Chip Cookies",
  "description": "Classic cookies...",
  "recipeIngredient": [
    "2 cups flour",
    "1 cup sugar"
  ],
  "recipeInstructions": [
    "Mix ingredients",
    "Bake at 350°F for 12 minutes"
  ],
  "recipeYield": "24 cookies"
}
```

Or nested in `@graph`:
```json
{
  "@graph": [
    { "@type": "Recipe", ... }
  ]
}
```

### Ingredient/Step Parsing
- **Ingredients:** Array of strings, cleaned of extra whitespace
- **Steps:** 
  - Array of strings → used as-is
  - Array of objects with `text` field → extracts text
  - Single string → converts to one-element array
  - Empty results filtered out

### Servings Extraction
- Extracts numbers from yield string (e.g., "Serves 4" → "4")
- Defaults to "1" if not found

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- iOS Safari: Full support (will show review screen)

## Error Scenarios

| Scenario | Behavior |
|----------|----------|
| Invalid URL | Input validation error |
| URL unreachable | "Failed to fetch URL: ..." |
| No recipe on page | "No recipe found on this page..." |
| Malformed JSON-LD | Searches next `<script>` block |
| Network timeout | "Failed to fetch URL: timeout" |

## User Flow

1. Click **Import** button in Kitchen header
2. Paste recipe URL (e.g., https://www.allrecipes.com/recipe/12345/)
3. Click **Import**
4. Review parsed recipe:
   - Title auto-filled ✓
   - Ingredients auto-filled ✓
   - Steps auto-filled ✓
   - Servings shown
5. Edit any field (optional)
6. Add tags (optional)
7. Click **Save Recipe**
8. Recipe appears in Kitchen with all data

## Files Modified/Created

```
server/
  └── routes/
      └── recipes.js                    [MODIFIED - added /import-url endpoint]

client/
  ├── src/
  │   ├── components/
  │   │   └── ImportRecipeModal.jsx    [NEW]
  │   └── pages/
  │       └── Kitchen.jsx              [MODIFIED - added import button & modal]
```

## Future Enhancements

Possible improvements (not implemented):
- [ ] Use `recipe-scrapers` npm package for non-JSON-LD sites
- [ ] Support iCalendar format (some recipe sites use this)
- [ ] Automatic photo crawl from recipe page
- [ ] Better NYT Cooking support (may need Puppeteer)
- [ ] Cache parsed recipes to avoid re-fetching
- [ ] Import history / recent imports
- [ ] Batch import multiple recipes at once
- [ ] Recipe scaling preview (ingredients × servings)

## Testing Checklist

- [ ] Import button visible in Kitchen header
- [ ] Can paste AllRecipes URL
- [ ] Recipe title, ingredients, steps auto-fill
- [ ] Can edit any field before saving
- [ ] Can add tags before saving
- [ ] Recipe saves to Kitchen
- [ ] Back button returns to URL input
- [ ] Error message for invalid URLs
- [ ] Error message for URLs without recipe data

## Notes

- No external dependencies needed for basic JSON-LD parsing (built-in JSON.parse)
- User-Agent header helps with sites that block default requests
- Timeout set to 10s to prevent hanging on slow/blocked sites
- Parsed recipe is human-editable before commit to database
- Integrates with existing photo upload, tag system, and public/private toggle

---

*Last updated: May 2026*
