// src/utils/receiptOCRService.js

/**
 * Receipt OCR Service using Google Cloud Vision API
 * 
 * Firestore Structure Assumed:
 * - restaurants/{restaurantId}/menu/{section}/{itemId}
 *   - Each item: { id, name, description, station, price }
 * 
 * Station Mapping:
 * - Menu items have a "station" field (e.g., "grill", "fry", "salad", "sauté")
 * - BOH employees have a "station" field in their staff document
 * - We match items to employees based on station + shift schedule
 */

// You'll need to install: npm install @google-cloud/vision
// Or use REST API directly

const GOOGLE_VISION_API_KEY = process.env.REACT_APP_GOOGLE_VISION_API_KEY;
const GOOGLE_VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;

/**
 * Parse receipt image using Google Vision API
 * @param {File|string} imageFile - Image file or base64 string
 * @returns {Promise<Object>} Parsed receipt data with items array
 */
export async function parseReceiptImage(imageFile) {
  try {
    // Convert file to base64
    let base64Image;
    if (typeof imageFile === 'string') {
      base64Image = imageFile;
    } else {
      base64Image = await fileToBase64(imageFile);
    }

    // Call Google Vision API
    const response = await fetch(GOOGLE_VISION_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: base64Image.split(',')[1] || base64Image, // Remove data:image/... prefix if present
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 1,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Google Vision API error: ${response.statusText}`);
    }

    const data = await response.json();
    const textAnnotations = data.responses[0]?.textAnnotations?.[0]?.description || '';

    // Parse receipt text to extract items
    const items = parseReceiptText(textAnnotations);

    return {
      success: true,
      items,
      rawText: textAnnotations,
    };
  } catch (error) {
    console.error('Error parsing receipt:', error);
    return {
      success: false,
      items: [],
      rawText: '',
      error: error.message,
    };
  }
}

/**
 * Convert file to base64
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Parse receipt text to extract menu items
 * This is a basic parser - you may want to enhance this with ML or more sophisticated parsing
 */
function parseReceiptText(text) {
  const items = [];
  const lines = text.split('\n').filter(line => line.trim());

  // Common receipt patterns:
  // - Item name followed by price
  // - Quantity x Item name = Price
  // - Item name $Price

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // Skip headers, totals, tax lines
    if (
      trimmed.toLowerCase().includes('total') ||
      trimmed.toLowerCase().includes('tax') ||
      trimmed.toLowerCase().includes('subtotal') ||
      trimmed.toLowerCase().includes('tip') ||
      trimmed.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}/) // Date
    ) {
      return;
    }

    // Try to extract item name and price
    const priceMatch = trimmed.match(/\$?(\d+\.\d{2})/);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1]);
      const itemName = trimmed.replace(priceMatch[0], '').trim();
      
      if (itemName && price > 0 && price < 1000) {
        items.push({
          name: itemName,
          price: price,
          quantity: 1,
        });
      }
    }
  });

  return items;
}

/**
 * Match parsed receipt items to menu items
 * @param {Array} receiptItems - Items from receipt
 * @param {Array} menuItems - All menu items from restaurant
 * @returns {Array} Matched items with menu item IDs
 */
export function matchReceiptItemsToMenu(receiptItems, menuItems) {
  const matched = [];

  receiptItems.forEach((receiptItem) => {
    // Fuzzy match by name
    const bestMatch = menuItems.find((menuItem) => {
      const menuName = menuItem.name.toLowerCase();
      const receiptName = receiptItem.name.toLowerCase();
      
      // Exact match
      if (menuName === receiptName) return true;
      
      // Contains match
      if (menuName.includes(receiptName) || receiptName.includes(menuName)) return true;
      
      // Word match (check if key words match)
      const menuWords = menuName.split(/\s+/);
      const receiptWords = receiptName.split(/\s+/);
      const matchingWords = menuWords.filter(word => 
        receiptWords.some(rWord => word.length > 3 && rWord.includes(word))
      );
      
      return matchingWords.length >= 2;
    });

    if (bestMatch) {
      matched.push({
        ...bestMatch,
        receiptQuantity: receiptItem.quantity || 1,
        receiptPrice: receiptItem.price,
        matched: true,
      });
    } else {
      // Add as unmatched item (user can manually select)
      matched.push({
        name: receiptItem.name,
        price: receiptItem.price,
        quantity: receiptItem.quantity || 1,
        matched: false,
      });
    }
  });

  return matched;
}