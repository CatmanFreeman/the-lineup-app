/**
 * Geocode Address using Nominatim (OpenStreetMap)
 * 
 * FREE alternative to Google Geocoding API
 * No API key required, but rate-limited (1 request/second)
 */

const https = require('https');

/**
 * Geocode an address using Nominatim (OpenStreetMap)
 * @param {Object} address - Address object with line1, city, state, zip
 * @returns {Promise<{lat: number, lng: number, formattedAddress: string}>}
 */
function geocodeAddressNominatim(address) {
  return new Promise((resolve, reject) => {
    if (!address || typeof address !== 'object') {
      reject(new Error('Invalid address object'));
      return;
    }

    // Build address string
    const addressParts = [];
    if (address.line1) addressParts.push(address.line1);
    if (address.city) addressParts.push(address.city);
    if (address.state) addressParts.push(address.state);
    if (address.zip) addressParts.push(address.zip);

    if (addressParts.length === 0) {
      reject(new Error('Address is empty'));
      return;
    }

    const addressString = addressParts.join(', ');
    const encodedAddress = encodeURIComponent(addressString);
    
    // Nominatim API (free, no key required)
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;

    https.get(url, {
      headers: {
        'User-Agent': 'LineupApp/1.0' // Required by Nominatim
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          if (result && result.length > 0) {
            const location = result[0];
            resolve({
              lat: parseFloat(location.lat),
              lng: parseFloat(location.lon),
              formattedAddress: location.display_name,
            });
          } else {
            reject(new Error(`No results found for address: ${addressString}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Check if coordinates are in water
 */
function isInWater(lat, lng) {
  // Lake Pontchartrain
  if (lat >= 30.0 && lat <= 30.25 && lng >= -90.25 && lng <= -90.0) {
    return true;
  }
  
  // Lake Borgne
  if (lat >= 29.95 && lat <= 30.1 && lng >= -89.75 && lng <= -89.5) {
    return true;
  }
  
  // Mississippi River
  if (lat >= 29.85 && lat <= 30.1 && lng >= -90.02 && lng <= -89.92) {
    return true;
  }
  
  return false;
}

/**
 * Geocode with water validation
 */
async function geocodeAddressSafe(address, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await geocodeAddressNominatim(address);
      
      // Check if in water
      if (isInWater(result.lat, result.lng)) {
        console.warn(`⚠️  Coordinates in water: ${result.lat}, ${result.lng}`);
        
        // Adjust coordinates away from water
        const offset = 0.01; // ~0.6 miles
        result.lat += offset;
        result.lng -= offset; // Shift west (away from river)
        
        if (!isInWater(result.lat, result.lng)) {
          console.log(`✅ Adjusted coordinates to avoid water: ${result.lat}, ${result.lng}`);
          return result;
        }
      }
      
      return result;
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
      // Rate limiting: Nominatim requires 1 request per second
      await new Promise(resolve => setTimeout(resolve, 1100));
    }
  }
}

module.exports = {
  geocodeAddress: geocodeAddressNominatim,
  geocodeAddressSafe,
  isInWater,
};





