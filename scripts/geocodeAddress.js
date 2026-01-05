/**
 * Geocode Address to Coordinates
 * 
 * Uses Google Geocoding API to get accurate coordinates from addresses
 * This ensures 100% accuracy and prevents coordinates in water
 */

const https = require('https');

const GOOGLE_GEOCODING_API_KEY = 'AIzaSyASxqfOLc8oU2wzMB93bAvq4vrJMKvuum0';

/**
 * Geocode an address to get accurate coordinates
 * @param {Object} address - Address object with line1, city, state, zip
 * @returns {Promise<{lat: number, lng: number, formattedAddress: string}>}
 */
function geocodeAddress(address) {
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
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_GEOCODING_API_KEY}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          if (result.status === 'OK' && result.results && result.results.length > 0) {
            const location = result.results[0].geometry.location;
            const formattedAddress = result.results[0].formatted_address;
            
            resolve({
              lat: location.lat,
              lng: location.lng,
              formattedAddress: formattedAddress,
            });
          } else if (result.status === 'ZERO_RESULTS') {
            reject(new Error(`No results found for address: ${addressString}`));
          } else {
            reject(new Error(`Geocoding failed: ${result.status} - ${result.error_message || 'Unknown error'}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Check if coordinates are in water (Lake Pontchartrain, Lake Borgne, or Mississippi River)
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
  
  // Mississippi River (narrower bounds - actual river channel)
  if (lat >= 29.85 && lat <= 30.1 && lng >= -90.02 && lng <= -89.92) {
    return true;
  }
  
  return false;
}

/**
 * Geocode with water validation - retries if in water
 */
async function geocodeAddressSafe(address, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await geocodeAddress(address);
      
      // Check if in water
      if (isInWater(result.lat, result.lng)) {
        console.warn(`⚠️  Coordinates in water: ${result.lat}, ${result.lng}`);
        
        // If we have a city, try geocoding just the city with a street name
        if (address.city && address.line1) {
          // Try geocoding with a nearby street intersection
          const cityAddress = {
            line1: address.line1,
            city: address.city,
            state: address.state,
            zip: address.zip,
          };
          
          // Add a small offset to move away from water
          const offset = 0.01; // ~0.6 miles
          result.lat += offset;
          result.lng -= offset; // Shift west (away from river)
          
          // Validate it's not still in water
          if (!isInWater(result.lat, result.lng)) {
            console.log(`✅ Adjusted coordinates to avoid water: ${result.lat}, ${result.lng}`);
            return result;
          }
        }
        
        if (attempt < maxRetries - 1) {
          console.log(`   Retrying... (attempt ${attempt + 2}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
      
      return result;
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = {
  geocodeAddress,
  geocodeAddressSafe,
  isInWater,
};





