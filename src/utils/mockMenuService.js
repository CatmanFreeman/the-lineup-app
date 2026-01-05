// src/utils/mockMenuService.js

import { collection, doc, setDoc, getDocs, updateDoc, getDoc, query, where } from "firebase/firestore";
import { db } from "../hooks/services/firebase";

/**
 * Create mock menu for Bravo Kitchen
 * Menu items organized by section with realistic names and stations
 */
export async function createMockMenuForBravoKitchen() {
  try {
    // First, find Bravo Kitchen restaurant ID
    const restaurantsRef = collection(db, "restaurants");
    const restaurantsSnap = await getDocs(restaurantsRef);
    
    let bravoKitchenId = null;
    restaurantsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.name && data.name.toLowerCase().includes("bravo")) {
        bravoKitchenId = docSnap.id;
      }
    });

    if (!bravoKitchenId) {
      console.error("Bravo Kitchen not found. Please create the restaurant first.");
      return false;
    }

    console.log(`Creating mock menu for Bravo Kitchen (ID: ${bravoKitchenId})`);

    // Menu items by section
    const menuItems = {
      beverages: [
        { name: "Coca-Cola", price: 3.50, station: null },
        { name: "Diet Coke", price: 3.50, station: null },
        { name: "Sprite", price: 3.50, station: null },
        { name: "Iced Tea", price: 3.50, station: null },
        { name: "Lemonade", price: 4.00, station: null },
        { name: "Fresh Orange Juice", price: 5.00, station: null },
        { name: "Coffee", price: 3.00, station: null },
        { name: "Espresso", price: 4.50, station: null },
      ],
      alcoholic_drinks: [
        { name: "House Wine - Red", price: 8.00, station: "bar" },
        { name: "House Wine - White", price: 8.00, station: "bar" },
        { name: "Craft Beer - IPA", price: 6.50, station: "bar" },
        { name: "Craft Beer - Lager", price: 6.50, station: "bar" },
        { name: "Old Fashioned", price: 12.00, station: "bar" },
        { name: "Moscow Mule", price: 11.00, station: "bar" },
        { name: "Margarita", price: 10.00, station: "bar" },
        { name: "Mojito", price: 11.00, station: "bar" },
      ],
      appetizers: [
        { name: "Bruschetta", price: 9.00, station: "cold" },
        { name: "Caesar Salad", price: 10.00, station: "cold" },
        { name: "Spinach Artichoke Dip", price: 11.00, station: "fry" },
        { name: "Chicken Wings", price: 12.00, station: "fry" },
        { name: "Mozzarella Sticks", price: 9.00, station: "fry" },
        { name: "Shrimp Cocktail", price: 14.00, station: "cold" },
        { name: "Calamari", price: 13.00, station: "fry" },
        { name: "Loaded Nachos", price: 12.00, station: "fry" },
      ],
      entrees: [
        { name: "Grilled Salmon", price: 24.00, station: "grill" },
        { name: "Ribeye Steak", price: 32.00, station: "grill" },
        { name: "Chicken Parmesan", price: 18.00, station: "fry" },
        { name: "Pasta Carbonara", price: 17.00, station: "pasta" },
        { name: "Margherita Pizza", price: 14.00, station: "pizza" },
        { name: "Pepperoni Pizza", price: 16.00, station: "pizza" },
        { name: "BBQ Pulled Pork Sandwich", price: 15.00, station: "grill" },
        { name: "Fish Tacos", price: 16.00, station: "fry" },
        { name: "Burgers - Classic", price: 14.00, station: "grill" },
        { name: "Burgers - Bacon Cheeseburger", price: 16.00, station: "grill" },
        { name: "Chicken Alfredo", price: 19.00, station: "pasta" },
        { name: "Lobster Roll", price: 28.00, station: "cold" },
      ],
      sides: [
        { name: "French Fries", price: 5.00, station: "fry" },
        { name: "Sweet Potato Fries", price: 6.00, station: "fry" },
        { name: "Onion Rings", price: 6.00, station: "fry" },
        { name: "Mashed Potatoes", price: 5.00, station: "grill" },
        { name: "Roasted Vegetables", price: 6.00, station: "grill" },
        { name: "Side Salad", price: 5.00, station: "cold" },
        { name: "Garlic Bread", price: 4.00, station: "pasta" },
        { name: "Mac & Cheese", price: 6.00, station: "pasta" },
      ],
      desserts: [
        { name: "Chocolate Lava Cake", price: 8.00, station: "pastry" },
        { name: "New York Cheesecake", price: 7.00, station: "pastry" },
        { name: "Tiramisu", price: 8.00, station: "pastry" },
        { name: "Ice Cream Sundae", price: 6.00, station: "pastry" },
        { name: "Apple Pie", price: 7.00, station: "pastry" },
        { name: "Key Lime Pie", price: 7.00, station: "pastry" },
      ],
    };

    // Create menu items in Firestore
    const sections = {
      beverages: "beverages",
      alcoholic_drinks: "alcoholic_drinks",
      appetizers: "appetizers",
      entrees: "entrees",
      sides: "sides",
      desserts: "desserts",
    };

    let totalCreated = 0;

    for (const [sectionKey, sectionName] of Object.entries(sections)) {
      const items = menuItems[sectionKey] || [];
      
      for (const item of items) {
        const itemId = `bravo_${sectionKey}_${item.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
        // Store items directly in menu collection (not in subcollections)
        const itemRef = doc(
          db,
          "restaurants",
          bravoKitchenId,
          "menu",
          itemId
        );

        await setDoc(itemRef, {
          name: item.name,
          price: item.price,
          section: sectionName,
          station: item.station || null,
          description: null,
          imageURL: item.imageURL || null, // Can be added later
          available: true,
          createdAt: new Date(),
        });

        totalCreated++;
      }
    }

    console.log(`✅ Created ${totalCreated} menu items for Bravo Kitchen`);
    return true;
  } catch (error) {
    console.error("Error creating mock menu:", error);
    return false;
  }
}

/**
 * Create Bravo Kitchen menu for a specific restaurant ID
 */
export async function createBravoKitchenMenuForRestaurant(restaurantId) {
  try {
    if (!restaurantId) {
      console.error("Restaurant ID is required");
      return false;
    }

    console.log(`Creating Bravo Kitchen menu for restaurant (ID: ${restaurantId})`);

    // Menu items by section
    const menuItems = {
      beverages: [
        { name: "Coca-Cola", price: 3.50, station: null },
        { name: "Diet Coke", price: 3.50, station: null },
        { name: "Sprite", price: 3.50, station: null },
        { name: "Iced Tea", price: 3.50, station: null },
        { name: "Lemonade", price: 4.00, station: null },
        { name: "Fresh Orange Juice", price: 5.00, station: null },
        { name: "Coffee", price: 3.00, station: null },
        { name: "Espresso", price: 4.50, station: null },
      ],
      alcoholic_drinks: [
        { name: "House Wine - Red", price: 8.00, station: "bar" },
        { name: "House Wine - White", price: 8.00, station: "bar" },
        { name: "Craft Beer - IPA", price: 6.50, station: "bar" },
        { name: "Craft Beer - Lager", price: 6.50, station: "bar" },
        { name: "Old Fashioned", price: 12.00, station: "bar" },
        { name: "Moscow Mule", price: 11.00, station: "bar" },
        { name: "Margarita", price: 10.00, station: "bar" },
        { name: "Mojito", price: 11.00, station: "bar" },
      ],
      appetizers: [
        { name: "Bruschetta", price: 9.00, station: "cold" },
        { name: "Caesar Salad", price: 10.00, station: "cold" },
        { name: "Spinach Artichoke Dip", price: 11.00, station: "fry" },
        { name: "Chicken Wings", price: 12.00, station: "fry" },
        { name: "Mozzarella Sticks", price: 9.00, station: "fry" },
        { name: "Shrimp Cocktail", price: 14.00, station: "cold" },
        { name: "Calamari", price: 13.00, station: "fry" },
        { name: "Loaded Nachos", price: 12.00, station: "fry" },
      ],
      entrees: [
        { name: "Grilled Salmon", price: 24.00, station: "grill" },
        { name: "Ribeye Steak", price: 32.00, station: "grill" },
        { name: "Chicken Parmesan", price: 18.00, station: "fry" },
        { name: "Pasta Carbonara", price: 17.00, station: "pasta" },
        { name: "Margherita Pizza", price: 14.00, station: "pizza" },
        { name: "Pepperoni Pizza", price: 16.00, station: "pizza" },
        { name: "BBQ Pulled Pork Sandwich", price: 15.00, station: "grill" },
        { name: "Fish Tacos", price: 16.00, station: "fry" },
        { name: "Burgers - Classic", price: 14.00, station: "grill" },
        { name: "Burgers - Bacon Cheeseburger", price: 16.00, station: "grill" },
        { name: "Chicken Alfredo", price: 19.00, station: "pasta" },
        { name: "Lobster Roll", price: 28.00, station: "cold" },
      ],
      sides: [
        { name: "French Fries", price: 5.00, station: "fry" },
        { name: "Sweet Potato Fries", price: 6.00, station: "fry" },
        { name: "Onion Rings", price: 6.00, station: "fry" },
        { name: "Mashed Potatoes", price: 5.00, station: "grill" },
        { name: "Roasted Vegetables", price: 6.00, station: "grill" },
        { name: "Side Salad", price: 5.00, station: "cold" },
        { name: "Garlic Bread", price: 4.00, station: "pasta" },
        { name: "Mac & Cheese", price: 6.00, station: "pasta" },
      ],
      desserts: [
        { name: "Chocolate Lava Cake", price: 8.00, station: "pastry" },
        { name: "New York Cheesecake", price: 7.00, station: "pastry" },
        { name: "Tiramisu", price: 8.00, station: "pastry" },
        { name: "Ice Cream Sundae", price: 6.00, station: "pastry" },
        { name: "Apple Pie", price: 7.00, station: "pastry" },
        { name: "Key Lime Pie", price: 7.00, station: "pastry" },
      ],
    };

    // Create menu items in Firestore
    const sections = {
      beverages: "beverages",
      alcoholic_drinks: "alcoholic_drinks",
      appetizers: "appetizers",
      entrees: "entrees",
      sides: "sides",
      desserts: "desserts",
    };

    let totalCreated = 0;

    for (const [sectionKey, sectionName] of Object.entries(sections)) {
      const items = menuItems[sectionKey] || [];
      
      for (const item of items) {
        const itemId = `bravo_${sectionKey}_${item.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
        // Store items directly in the menu collection, not in subcollections
        const itemRef = doc(
          db,
          "restaurants",
          restaurantId,
          "menu",
          itemId
        );

        await setDoc(itemRef, {
          name: item.name,
          price: item.price,
          section: sectionName,
          station: item.station || null,
          description: null,
          imageURL: item.imageURL || null,
          available: true,
          createdAt: new Date(),
        });

        totalCreated++;
      }
    }

    console.log(`✅ Created ${totalCreated} menu items for Bravo Kitchen (restaurant ${restaurantId})`);
    return true;
  } catch (error) {
    console.error("Error creating Bravo Kitchen menu:", error);
    return false;
  }
}

/**
 * Create comprehensive Chili's menu for a specific restaurant ID
 */
export async function createChilisMenuForRestaurant(restaurantId) {
  try {
    if (!restaurantId) {
      console.error("Restaurant ID is required");
      return false;
    }

    console.log(`Creating Chili's menu for restaurant (ID: ${restaurantId})`);

    // Comprehensive Chili's menu items
    const menuItems = {
      beverages: [
        { name: "Coca-Cola", price: 2.99, station: null, imageURL: "https://www.coca-cola.com/content/dam/onexp/us/en/brands/coca-cola/coca-cola-logo.png" },
        { name: "Diet Coke", price: 2.99, station: null, imageURL: "https://www.coca-cola.com/content/dam/onexp/us/en/brands/diet-coke/diet-coke-logo.png" },
        { name: "Sprite", price: 2.99, station: null, imageURL: "https://www.coca-cola.com/content/dam/onexp/us/en/brands/sprite/sprite-logo.png" },
        { name: "Dr Pepper", price: 2.99, station: null, imageURL: "https://www.drpepper.com/content/dam/nagbrands/us/drpepper/en_us/logo/dr-pepper-logo.png" },
        { name: "Iced Tea", price: 2.99, station: null, imageURL: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400" },
        { name: "Sweet Tea", price: 2.99, station: null, imageURL: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400" },
        { name: "Lemonade", price: 3.49, station: null, imageURL: "https://images.unsplash.com/photo-1523677011787-c91d1bbe2fdc?w=400" },
        { name: "Fresh Brewed Iced Tea", price: 2.99, station: null, imageURL: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400" },
        { name: "Coffee", price: 2.49, station: null, imageURL: "https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400" },
        { name: "Hot Tea", price: 2.49, station: null, imageURL: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400" },
        { name: "Ice Water", price: 0.00, station: null, imageURL: "https://images.unsplash.com/photo-1523362628745-0c100150b504?w=400" },
        { name: "Bottled Water", price: 2.50, station: null, imageURL: "https://images.unsplash.com/photo-1548839140-5a9415c75b5a?w=400" },
      ],
      alcoholic_drinks: [
        { name: "House Margarita", price: 6.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400" },
        { name: "Top Shelf Margarita", price: 8.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400" },
        { name: "Strawberry Margarita", price: 7.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400" },
        { name: "Mango Margarita", price: 7.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400" },
        { name: "Long Island Iced Tea", price: 7.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400" },
        { name: "Beer - Domestic", price: 4.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1535958637004-8967b619ed4b?w=400" },
        { name: "Beer - Import", price: 5.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef7?w=400" },
        { name: "Beer - Craft", price: 6.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1535958637004-8967b619ed4b?w=400" },
        { name: "House Wine - Red", price: 6.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400" },
        { name: "House Wine - White", price: 6.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1506377247727-4b6f2f4a1e4a?w=400" },
        { name: "Sangria", price: 7.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1546171753-97d7676e4602?w=400" },
        { name: "Mojito", price: 7.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1546171753-97d7676e4602?w=400" },
      ],
      appetizers: [
        { name: "Southwestern Eggrolls", price: 9.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400" },
        { name: "Skillet Queso", price: 8.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=400" },
        { name: "Boneless Wings", price: 10.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=400" },
        { name: "Classic Nachos", price: 9.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=400" },
        { name: "Loaded Boneless Wings", price: 11.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=400" },
        { name: "Triple Dipper", price: 12.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400" },
        { name: "Chips & Salsa", price: 4.99, station: "cold", imageURL: "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=400" },
        { name: "Fried Pickles", price: 7.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1615367427256-7b3c711f45c1?w=400" },
        { name: "Buffalo Chicken Ranch Dip", price: 9.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400" },
        { name: "Crispy Cheddar Bites", price: 8.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1615367427256-7b3c711f45c1?w=400" },
      ],
      entrees: [
        { name: "Original Chili's Burger", price: 11.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400" },
        { name: "Bacon Avocado Grilled Chicken", price: 13.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400" },
        { name: "Oldtimer with Cheese", price: 12.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=400" },
        { name: "Bacon Rancher Burger", price: 13.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=400" },
        { name: "Chili's Classic Ribs - Full Rack", price: 19.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1528607929212-2636ec44253e?w=400" },
        { name: "Chili's Classic Ribs - Half Rack", price: 15.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1528607929212-2636ec44253e?w=400" },
        { name: "Smoked Brisket", price: 16.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400" },
        { name: "Smoked Brisket Tacos", price: 14.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1565299585323-38174c0a5c5a?w=400" },
        { name: "Grilled Chicken Fajitas", price: 15.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1565299585323-38174c0a5c5a?w=400" },
        { name: "Steak Fajitas", price: 17.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1565299585323-38174c0a5c5a?w=400" },
        { name: "Shrimp Fajitas", price: 16.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1565299585323-38174c0a5c5a?w=400" },
        { name: "Chicken Crispers", price: 13.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=400" },
        { name: "Honey Chipotle Crispers", price: 14.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=400" },
        { name: "Cajun Chicken Pasta", price: 14.99, station: "pasta", imageURL: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400" },
        { name: "Chicken Enchiladas", price: 13.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1565299585323-38174c0a5c5a?w=400" },
        { name: "Grilled Chicken Salad", price: 12.99, station: "cold", imageURL: "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400" },
        { name: "Quesadilla Explosion Salad", price: 13.99, station: "cold", imageURL: "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400" },
        { name: "Cajun Shrimp Pasta", price: 15.99, station: "pasta", imageURL: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400" },
        { name: "Ancho Salmon", price: 17.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400" },
        { name: "Mango Chile Chicken", price: 14.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400" },
      ],
      sides: [
        { name: "French Fries", price: 3.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400" },
        { name: "Loaded Mashed Potatoes", price: 4.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?w=400" },
        { name: "Black Beans", price: 3.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1572441713132-51c75654db73?w=400" },
        { name: "Mexican Rice", price: 3.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1512058564366-18510b2e7af8?w=400" },
        { name: "Steamed Broccoli", price: 3.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1512058564366-18510b2e7af8?w=400" },
        { name: "Corn on the Cob", price: 3.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1512058564366-18510b2e7af8?w=400" },
        { name: "Side Salad", price: 3.99, station: "cold", imageURL: "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400" },
        { name: "Coleslaw", price: 3.49, station: "cold", imageURL: "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400" },
        { name: "Chips & Salsa", price: 3.99, station: "cold", imageURL: "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=400" },
        { name: "Onion Strings", price: 4.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1615367427256-7b3c711f45c1?w=400" },
      ],
      desserts: [
        { name: "Molten Chocolate Cake", price: 7.99, station: "pastry", imageURL: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400" },
        { name: "Skillet Chocolate Chip Cookie", price: 7.99, station: "pastry", imageURL: "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400" },
        { name: "Cheesecake", price: 6.99, station: "pastry", imageURL: "https://images.unsplash.com/photo-1524351199678-941a58a3df50?w=400" },
        { name: "Fried Oreos", price: 6.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400" },
        { name: "Sopapillas", price: 5.99, station: "pastry", imageURL: "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400" },
        { name: "Churros", price: 6.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400" },
      ],
    };

    // Create menu items in Firestore
    const sections = {
      beverages: "beverages",
      alcoholic_drinks: "alcoholic_drinks",
      appetizers: "appetizers",
      entrees: "entrees",
      sides: "sides",
      desserts: "desserts",
    };

    let totalCreated = 0;

    for (const [sectionKey, sectionName] of Object.entries(sections)) {
      const items = menuItems[sectionKey] || [];
      
      for (const item of items) {
        const itemId = `chilis_${sectionKey}_${item.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
        // Store items directly in menu collection (not in subcollections)
        const itemRef = doc(
          db,
          "restaurants",
          restaurantId,
          "menu",
          itemId
        );

        await setDoc(itemRef, {
          name: item.name,
          price: item.price,
          section: sectionName,
          station: item.station || null,
          description: null,
          imageURL: item.imageURL || null,
          available: true,
          createdAt: new Date(),
        });

        totalCreated++;
      }
    }

    console.log(`✅ Created ${totalCreated} menu items for restaurant ${restaurantId}`);
    return true;
  } catch (error) {
    console.error("Error creating Chili's menu:", error);
    return false;
  }
}

/**
 * Create comprehensive Texas Roadhouse menu for a specific restaurant ID
 */
export async function createTexasRoadhouseMenuForRestaurant(restaurantId) {
  try {
    if (!restaurantId) {
      console.error("Restaurant ID is required");
      return false;
    }

    console.log(`Creating Texas Roadhouse menu for restaurant (ID: ${restaurantId})`);

    // Comprehensive Texas Roadhouse menu items
    const menuItems = {
      beverages: [
        { name: "Coca-Cola", price: 2.99, station: null, imageURL: "https://www.coca-cola.com/content/dam/onexp/us/en/brands/coca-cola/coca-cola-logo.png" },
        { name: "Diet Coke", price: 2.99, station: null, imageURL: "https://www.coca-cola.com/content/dam/onexp/us/en/brands/diet-coke/diet-coke-logo.png" },
        { name: "Sprite", price: 2.99, station: null, imageURL: "https://www.coca-cola.com/content/dam/onexp/us/en/brands/sprite/sprite-logo.png" },
        { name: "Dr Pepper", price: 2.99, station: null, imageURL: "https://www.drpepper.com/content/dam/nagbrands/us/drpepper/en_us/logo/dr-pepper-logo.png" },
        { name: "Iced Tea", price: 2.99, station: null, imageURL: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400" },
        { name: "Sweet Tea", price: 2.99, station: null, imageURL: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400" },
        { name: "Lemonade", price: 3.49, station: null, imageURL: "https://images.unsplash.com/photo-1523677011787-c91d1bbe2fdc?w=400" },
        { name: "Fresh Brewed Iced Tea", price: 2.99, station: null, imageURL: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400" },
        { name: "Coffee", price: 2.49, station: null, imageURL: "https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400" },
        { name: "Hot Tea", price: 2.49, station: null, imageURL: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400" },
        { name: "Root Beer", price: 2.99, station: null, imageURL: "https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef7?w=400" },
        { name: "Orange Juice", price: 3.99, station: null, imageURL: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400" },
        { name: "Ice Water", price: 0.00, station: null, imageURL: "https://images.unsplash.com/photo-1523362628745-0c100150b504?w=400" },
        { name: "Bottled Water", price: 2.50, station: null, imageURL: "https://images.unsplash.com/photo-1548839140-5a9415c75b5a?w=400" },
      ],
      alcoholic_drinks: [
        { name: "Long Island Iced Tea", price: 7.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400" },
        { name: "Margarita", price: 7.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400" },
        { name: "Strawberry Margarita", price: 8.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400" },
        { name: "Beer - Domestic", price: 4.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1535958637004-8967b619ed4b?w=400" },
        { name: "Beer - Import", price: 5.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef7?w=400" },
        { name: "Beer - Craft", price: 6.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1535958637004-8967b619ed4b?w=400" },
        { name: "House Wine - Red", price: 6.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400" },
        { name: "House Wine - White", price: 6.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1506377247727-4b6f2f4a1e4a?w=400" },
        { name: "Whiskey Sour", price: 7.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400" },
        { name: "Mojito", price: 7.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1546171753-97d7676e4602?w=400" },
        { name: "Old Fashioned", price: 8.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400" },
        { name: "Texas Roadhouse Special", price: 9.99, station: "bar", imageURL: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400" },
      ],
      appetizers: [
        { name: "Rattlesnake Bites", price: 9.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=400" },
        { name: "Cactus Blossom", price: 8.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1615367427256-7b3c711f45c1?w=400" },
        { name: "Tater Skins", price: 9.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400" },
        { name: "Fried Pickles", price: 7.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1615367427256-7b3c711f45c1?w=400" },
        { name: "Boneless Wings", price: 10.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=400" },
        { name: "Loaded Potato Skins", price: 10.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400" },
        { name: "Chili Cheese Fries", price: 8.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400" },
        { name: "Onion Rings", price: 7.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1615367427256-7b3c711f45c1?w=400" },
        { name: "Mozzarella Sticks", price: 8.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1615367427256-7b3c711f45c1?w=400" },
        { name: "Combo Appetizer", price: 12.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400" },
      ],
      entrees: [
        { name: "6 oz. Sirloin", price: 15.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1546833614-9e3b8b0b1f1a?w=400" },
        { name: "8 oz. Sirloin", price: 18.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1546833614-9e3b8b0b1f1a?w=400" },
        { name: "11 oz. Sirloin", price: 21.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1546833614-9e3b8b0b1f1a?w=400" },
        { name: "Ribeye Steak - 12 oz.", price: 24.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1546833614-9e3b8b0b1f1a?w=400" },
        { name: "Ribeye Steak - 16 oz.", price: 28.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1546833614-9e3b8b0b1f1a?w=400" },
        { name: "Filet Medallions", price: 22.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1546833614-9e3b8b0b1f1a?w=400" },
        { name: "Porterhouse T-Bone", price: 26.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1546833614-9e3b8b0b1f1a?w=400" },
        { name: "Dallas Filet", price: 23.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1546833614-9e3b8b0b1f1a?w=400" },
        { name: "Ft. Worth Ribeye", price: 25.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1546833614-9e3b8b0b1f1a?w=400" },
        { name: "Smothered Steak", price: 20.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1546833614-9e3b8b0b1f1a?w=400" },
        { name: "Country Fried Sirloin", price: 16.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1546833614-9e3b8b0b1f1a?w=400" },
        { name: "Grilled BBQ Chicken", price: 15.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400" },
        { name: "Chicken Critters", price: 14.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=400" },
        { name: "Grilled Salmon", price: 19.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400" },
        { name: "Grilled Pork Chops", price: 17.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400" },
        { name: "Baby Back Ribs - Full Rack", price: 22.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1528607929212-2636ec44253e?w=400" },
        { name: "Baby Back Ribs - Half Rack", price: 18.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1528607929212-2636ec44253e?w=400" },
        { name: "Fall-Off-The-Bone Ribs", price: 21.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1528607929212-2636ec44253e?w=400" },
        { name: "Road Kill", price: 16.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1546833614-9e3b8b0b1f1a?w=400" },
        { name: "Chop Steak", price: 15.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1546833614-9e3b8b0b1f1a?w=400" },
      ],
      sides: [
        { name: "Loaded Baked Potato", price: 4.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?w=400" },
        { name: "Steak Fries", price: 3.99, station: "fry", imageURL: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400" },
        { name: "Sweet Potato", price: 4.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?w=400" },
        { name: "Rice Pilaf", price: 3.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1512058564366-18510b2e7af8?w=400" },
        { name: "Seasoned Rice", price: 3.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1512058564366-18510b2e7af8?w=400" },
        { name: "Fresh Steamed Broccoli", price: 3.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1512058564366-18510b2e7af8?w=400" },
        { name: "Fresh Corn", price: 3.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1512058564366-18510b2e7af8?w=400" },
        { name: "Side Salad", price: 3.99, station: "cold", imageURL: "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400" },
        { name: "Caesar Salad", price: 4.99, station: "cold", imageURL: "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400" },
        { name: "House Salad", price: 3.99, station: "cold", imageURL: "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400" },
        { name: "Mashed Potatoes", price: 3.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?w=400" },
        { name: "Loaded Mashed Potatoes", price: 4.99, station: "grill", imageURL: "https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?w=400" },
      ],
      desserts: [
        { name: "Big Ol' Brownie", price: 7.99, station: "pastry", imageURL: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400" },
        { name: "Strawberry Cheesecake", price: 7.99, station: "pastry", imageURL: "https://images.unsplash.com/photo-1524351199678-941a58a3df50?w=400" },
        { name: "Granny's Apple Classic", price: 6.99, station: "pastry", imageURL: "https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=400" },
        { name: "Caramel Apple Goldrush", price: 7.99, station: "pastry", imageURL: "https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=400" },
        { name: "Butter Cake", price: 6.99, station: "pastry", imageURL: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400" },
        { name: "New York Style Cheesecake", price: 7.99, station: "pastry", imageURL: "https://images.unsplash.com/photo-1524351199678-941a58a3df50?w=400" },
        { name: "Chocolate Chip Cookie", price: 5.99, station: "pastry", imageURL: "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400" },
      ],
    };

    // Create menu items in Firestore
    const sections = {
      beverages: "beverages",
      alcoholic_drinks: "alcoholic_drinks",
      appetizers: "appetizers",
      entrees: "entrees",
      sides: "sides",
      desserts: "desserts",
    };

    let totalCreated = 0;

    for (const [sectionKey, sectionName] of Object.entries(sections)) {
      const items = menuItems[sectionKey] || [];
      
      for (const item of items) {
        const itemId = `texas_${sectionKey}_${item.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
        // Store items directly in menu collection (not in subcollections)
        const itemRef = doc(
          db,
          "restaurants",
          restaurantId,
          "menu",
          itemId
        );

        await setDoc(itemRef, {
          name: item.name,
          price: item.price,
          section: sectionName,
          station: item.station || null,
          description: null,
          imageURL: item.imageURL || null,
          available: true,
          createdAt: new Date(),
        });

        totalCreated++;
      }
    }

    console.log(`✅ Created ${totalCreated} menu items for Texas Roadhouse (restaurant ${restaurantId})`);
    return true;
  } catch (error) {
    console.error("Error creating Texas Roadhouse menu:", error);
    return false;
  }
}

/**
 * Create comprehensive Chili's menu for San Marcos location (legacy function)
 * @deprecated Use createChilisMenuForRestaurant(restaurantId) instead
 */
export async function createChilisSanMarcosMenu() {
  try {
    // Find Chili's San Marcos restaurant ID
    const restaurantsRef = collection(db, "restaurants");
    const restaurantsSnap = await getDocs(restaurantsRef);
    
    let chilisId = null;
    restaurantsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const name = (data.name || "").toLowerCase();
      if (name.includes("chili") || name.includes("chilis") || name.includes("chili's")) {
        if (name.includes("san marcos") || name.includes("sanmarcos")) {
          chilisId = docSnap.id;
        } else if (!chilisId) {
          // Fallback to any Chili's if San Marcos not found
          chilisId = docSnap.id;
        }
      }
    });

    if (!chilisId) {
      console.error("Chili's San Marcos not found. Please create the restaurant first.");
      return false;
    }

    return await createChilisMenuForRestaurant(chilisId);
  } catch (error) {
    console.error("Error finding Chili's restaurant:", error);
    return false;
  }
}

/**
 * Get restaurant ID by name (case-insensitive partial match)
 */
export async function getRestaurantIdByName(restaurantName) {
  try {
    const restaurantsRef = collection(db, "restaurants");
    const restaurantsSnap = await getDocs(restaurantsRef);
    
    const searchName = restaurantName.toLowerCase();
    
    for (const docSnap of restaurantsSnap.docs) {
      const data = docSnap.data();
      if (data.name && data.name.toLowerCase().includes(searchName)) {
        return docSnap.id;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error finding restaurant:", error);
    return null;
  }
}

/**
 * Update existing menu items with imageURLs
 * This function adds imageURLs to menu items that don't have them
 */
export async function updateMenuItemsWithImages(restaurantId) {
  try {
    if (!restaurantId) {
      console.error("Restaurant ID is required");
      return false;
    }

    console.log(`Updating menu items with images for restaurant ${restaurantId}`);

    // Get restaurant name to determine which menu items to use
    const restaurantRef = doc(db, "restaurants", restaurantId);
    const restaurantSnap = await restaurantRef.get();
    const restaurantName = restaurantSnap.exists() ? restaurantSnap.data().name?.toLowerCase() || "" : "";

    // Load all menu items
    const menuRef = collection(db, "restaurants", restaurantId, "menu");
    const menuSnap = await getDocs(menuRef);

    let updated = 0;
    let skipped = 0;

    // Determine which menu items to use based on restaurant
    let allMenuItems = {};
    if (restaurantName.includes("bravo")) {
      allMenuItems = {
        beverages: [
          { name: "Coca-Cola", imageURL: "https://via.placeholder.com/200x200/FF0000/FFFFFF?text=Coca-Cola" },
          { name: "Diet Coke", imageURL: "https://via.placeholder.com/200x200/000000/FFFFFF?text=Diet+Coke" },
          { name: "Sprite", imageURL: "https://via.placeholder.com/200x200/00FF00/000000?text=Sprite" },
          { name: "Iced Tea", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Iced+Tea" },
          { name: "Lemonade", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Lemonade" },
          { name: "Fresh Orange Juice", imageURL: "https://via.placeholder.com/200x200/FF8C00/FFFFFF?text=OJ" },
          { name: "Coffee", imageURL: "https://via.placeholder.com/200x200/3E2723/FFFFFF?text=Coffee" },
          { name: "Espresso", imageURL: "https://via.placeholder.com/200x200/1A0000/FFFFFF?text=Espresso" },
          { name: "Ice Water", imageURL: "https://via.placeholder.com/200x200/E3F2FD/000000?text=Water" },
          { name: "Bottled Water", imageURL: "https://via.placeholder.com/200x200/E3F2FD/000000?text=Bottled" },
        ],
        alcoholic_drinks: [
          { name: "House Wine - Red", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=Red+Wine" },
          { name: "House Wine - White", imageURL: "https://via.placeholder.com/200x200/FFE4B5/000000?text=White+Wine" },
          { name: "Craft Beer - IPA", imageURL: "https://via.placeholder.com/200x200/FFA500/000000?text=IPA" },
          { name: "Craft Beer - Lager", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Lager" },
          { name: "Old Fashioned", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Old+Fashioned" },
          { name: "Moscow Mule", imageURL: "https://via.placeholder.com/200x200/00CED1/000000?text=Moscow+Mule" },
          { name: "Margarita", imageURL: "https://via.placeholder.com/200x200/00FF00/000000?text=Margarita" },
          { name: "Mojito", imageURL: "https://via.placeholder.com/200x200/98FB98/000000?text=Mojito" },
        ],
        appetizers: [
          { name: "Bruschetta", imageURL: "https://via.placeholder.com/200x200/FF6347/FFFFFF?text=Bruschetta" },
          { name: "Caesar Salad", imageURL: "https://via.placeholder.com/200x200/90EE90/000000?text=Caesar" },
          { name: "Spinach Artichoke Dip", imageURL: "https://via.placeholder.com/200x200/228B22/FFFFFF?text=Spinach+Dip" },
          { name: "Chicken Wings", imageURL: "https://via.placeholder.com/200x200/FF4500/FFFFFF?text=Wings" },
          { name: "Mozzarella Sticks", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Mozz+Sticks" },
          { name: "Shrimp Cocktail", imageURL: "https://via.placeholder.com/200x200/FF69B4/FFFFFF?text=Shrimp" },
          { name: "Calamari", imageURL: "https://via.placeholder.com/200x200/FFA500/000000?text=Calamari" },
          { name: "Loaded Nachos", imageURL: "https://via.placeholder.com/200x200/FF8C00/FFFFFF?text=Nachos" },
        ],
        entrees: [
          { name: "Grilled Salmon", imageURL: "https://via.placeholder.com/200x200/FF69B4/FFFFFF?text=Salmon" },
          { name: "Ribeye Steak", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=Steak" },
          { name: "Chicken Parmesan", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Chicken+Parm" },
          { name: "Pasta Carbonara", imageURL: "https://via.placeholder.com/200x200/FFF8DC/000000?text=Carbonara" },
          { name: "Margherita Pizza", imageURL: "https://via.placeholder.com/200x200/FF0000/FFFFFF?text=Pizza" },
          { name: "Pepperoni Pizza", imageURL: "https://via.placeholder.com/200x200/DC143C/FFFFFF?text=Pepperoni" },
          { name: "BBQ Pulled Pork Sandwich", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=BBQ+Pork" },
          { name: "Fish Tacos", imageURL: "https://via.placeholder.com/200x200/00CED1/000000?text=Fish+Tacos" },
          { name: "Burgers - Classic", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Burger" },
          { name: "Burgers - Bacon Cheeseburger", imageURL: "https://via.placeholder.com/200x200/A0522D/FFFFFF?text=Bacon+Burger" },
          { name: "Chicken Alfredo", imageURL: "https://via.placeholder.com/200x200/FFF8DC/000000?text=Alfredo" },
          { name: "Lobster Roll", imageURL: "https://via.placeholder.com/200x200/FF6347/FFFFFF?text=Lobster" },
        ],
        sides: [
          { name: "French Fries", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Fries" },
          { name: "Sweet Potato Fries", imageURL: "https://via.placeholder.com/200x200/FF8C00/FFFFFF?text=Sweet+Fries" },
          { name: "Onion Rings", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Onion+Rings" },
          { name: "Mashed Potatoes", imageURL: "https://via.placeholder.com/200x200/FFF8DC/000000?text=Mashed" },
          { name: "Roasted Vegetables", imageURL: "https://via.placeholder.com/200x200/90EE90/000000?text=Veggies" },
          { name: "Side Salad", imageURL: "https://via.placeholder.com/200x200/90EE90/000000?text=Salad" },
          { name: "Garlic Bread", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Garlic+Bread" },
          { name: "Mac & Cheese", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Mac+Cheese" },
        ],
        desserts: [
          { name: "Chocolate Lava Cake", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Lava+Cake" },
          { name: "New York Cheesecake", imageURL: "https://via.placeholder.com/200x200/FFF8DC/000000?text=Cheesecake" },
          { name: "Tiramisu", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Tiramisu" },
          { name: "Ice Cream Sundae", imageURL: "https://via.placeholder.com/200x200/FFE4E1/000000?text=Sundae" },
          { name: "Apple Pie", imageURL: "https://via.placeholder.com/200x200/FF8C00/FFFFFF?text=Apple+Pie" },
          { name: "Key Lime Pie", imageURL: "https://via.placeholder.com/200x200/98FB98/000000?text=Key+Lime" },
        ],
      };
    } else if (restaurantName.includes("chili")) {
      // Use Chili's menu items - simplified list
      allMenuItems = {
        beverages: [
          { name: "Coca-Cola", imageURL: "https://via.placeholder.com/200x200/FF0000/FFFFFF?text=Coca-Cola" },
          { name: "Diet Coke", imageURL: "https://via.placeholder.com/200x200/000000/FFFFFF?text=Diet+Coke" },
          { name: "Sprite", imageURL: "https://via.placeholder.com/200x200/00FF00/000000?text=Sprite" },
          { name: "Dr Pepper", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=Dr+Pepper" },
          { name: "Iced Tea", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Iced+Tea" },
          { name: "Sweet Tea", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Sweet+Tea" },
          { name: "Lemonade", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Lemonade" },
          { name: "Fresh Brewed Iced Tea", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Iced+Tea" },
          { name: "Coffee", imageURL: "https://via.placeholder.com/200x200/3E2723/FFFFFF?text=Coffee" },
          { name: "Hot Tea", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Hot+Tea" },
          { name: "Ice Water", imageURL: "https://via.placeholder.com/200x200/E3F2FD/000000?text=Water" },
          { name: "Bottled Water", imageURL: "https://via.placeholder.com/200x200/E3F2FD/000000?text=Bottled" },
        ],
        alcoholic_drinks: [
          { name: "House Margarita", imageURL: "https://via.placeholder.com/200x200/00FF00/000000?text=Margarita" },
          { name: "Top Shelf Margarita", imageURL: "https://via.placeholder.com/200x200/00FF00/000000?text=Top+Margarita" },
          { name: "Strawberry Margarita", imageURL: "https://via.placeholder.com/200x200/FF1493/FFFFFF?text=Straw+Marg" },
          { name: "Mango Margarita", imageURL: "https://via.placeholder.com/200x200/FFA500/000000?text=Mango+Marg" },
          { name: "Long Island Iced Tea", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=LIIT" },
          { name: "Beer - Domestic", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Beer" },
          { name: "Beer - Import", imageURL: "https://via.placeholder.com/200x200/FFA500/000000?text=Import+Beer" },
          { name: "Beer - Craft", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Craft+Beer" },
          { name: "House Wine - Red", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=Red+Wine" },
          { name: "House Wine - White", imageURL: "https://via.placeholder.com/200x200/FFE4B5/000000?text=White+Wine" },
          { name: "Sangria", imageURL: "https://via.placeholder.com/200x200/DC143C/FFFFFF?text=Sangria" },
          { name: "Mojito", imageURL: "https://via.placeholder.com/200x200/98FB98/000000?text=Mojito" },
        ],
        appetizers: [
          { name: "Southwestern Eggrolls", imageURL: "https://via.placeholder.com/200x200/FF8C00/FFFFFF?text=Eggrolls" },
          { name: "Skillet Queso", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Queso" },
          { name: "Boneless Wings", imageURL: "https://via.placeholder.com/200x200/FF4500/FFFFFF?text=Wings" },
          { name: "Classic Nachos", imageURL: "https://via.placeholder.com/200x200/FF8C00/FFFFFF?text=Nachos" },
          { name: "Loaded Boneless Wings", imageURL: "https://via.placeholder.com/200x200/FF4500/FFFFFF?text=Loaded+Wings" },
          { name: "Triple Dipper", imageURL: "https://via.placeholder.com/200x200/FF6347/FFFFFF?text=Triple+Dipper" },
          { name: "Chips & Salsa", imageURL: "https://via.placeholder.com/200x200/FF4500/FFFFFF?text=Chips+Salsa" },
          { name: "Fried Pickles", imageURL: "https://via.placeholder.com/200x200/90EE90/000000?text=Fried+Pickles" },
          { name: "Buffalo Chicken Ranch Dip", imageURL: "https://via.placeholder.com/200x200/FF4500/FFFFFF?text=Buffalo+Dip" },
          { name: "Crispy Cheddar Bites", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Cheddar+Bites" },
        ],
        entrees: [
          { name: "Original Chili's Burger", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Burger" },
          { name: "Bacon Avocado Grilled Chicken", imageURL: "https://via.placeholder.com/200x200/90EE90/000000?text=Chicken" },
          { name: "Oldtimer with Cheese", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Oldtimer" },
          { name: "Bacon Rancher Burger", imageURL: "https://via.placeholder.com/200x200/A0522D/FFFFFF?text=Rancher" },
          { name: "Chili's Classic Ribs - Full Rack", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=Full+Ribs" },
          { name: "Chili's Classic Ribs - Half Rack", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=Half+Ribs" },
          { name: "Smoked Brisket", imageURL: "https://via.placeholder.com/200x200/654321/FFFFFF?text=Brisket" },
          { name: "Smoked Brisket Tacos", imageURL: "https://via.placeholder.com/200x200/FF8C00/FFFFFF?text=Brisket+Tacos" },
          { name: "Grilled Chicken Fajitas", imageURL: "https://via.placeholder.com/200x200/FF6347/FFFFFF?text=Fajitas" },
          { name: "Steak Fajitas", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=Steak+Fajitas" },
          { name: "Shrimp Fajitas", imageURL: "https://via.placeholder.com/200x200/FF69B4/FFFFFF?text=Shrimp+Fajitas" },
          { name: "Chicken Crispers", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Crispers" },
          { name: "Honey Chipotle Crispers", imageURL: "https://via.placeholder.com/200x200/FF8C00/FFFFFF?text=Honey+Crispers" },
          { name: "Cajun Chicken Pasta", imageURL: "https://via.placeholder.com/200x200/FF6347/FFFFFF?text=Cajun+Pasta" },
          { name: "Chicken Enchiladas", imageURL: "https://via.placeholder.com/200x200/FF8C00/FFFFFF?text=Enchiladas" },
          { name: "Grilled Chicken Salad", imageURL: "https://via.placeholder.com/200x200/90EE90/000000?text=Chicken+Salad" },
          { name: "Quesadilla Explosion Salad", imageURL: "https://via.placeholder.com/200x200/90EE90/000000?text=Quesadilla+Salad" },
          { name: "Cajun Shrimp Pasta", imageURL: "https://via.placeholder.com/200x200/FF6347/FFFFFF?text=Shrimp+Pasta" },
          { name: "Ancho Salmon", imageURL: "https://via.placeholder.com/200x200/FF69B4/FFFFFF?text=Salmon" },
          { name: "Mango Chile Chicken", imageURL: "https://via.placeholder.com/200x200/FFA500/000000?text=Mango+Chicken" },
        ],
        sides: [
          { name: "French Fries", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Fries" },
          { name: "Loaded Mashed Potatoes", imageURL: "https://via.placeholder.com/200x200/FFF8DC/000000?text=Loaded+Mashed" },
          { name: "Black Beans", imageURL: "https://via.placeholder.com/200x200/000000/FFFFFF?text=Black+Beans" },
          { name: "Mexican Rice", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Mexican+Rice" },
          { name: "Steamed Broccoli", imageURL: "https://via.placeholder.com/200x200/90EE90/000000?text=Broccoli" },
          { name: "Corn on the Cob", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Corn" },
          { name: "Side Salad", imageURL: "https://via.placeholder.com/200x200/90EE90/000000?text=Salad" },
          { name: "Coleslaw", imageURL: "https://via.placeholder.com/200x200/FFF8DC/000000?text=Coleslaw" },
          { name: "Chips & Salsa", imageURL: "https://via.placeholder.com/200x200/FF4500/FFFFFF?text=Chips+Salsa" },
          { name: "Onion Strings", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Onion+Strings" },
        ],
        desserts: [
          { name: "Molten Chocolate Cake", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Lava+Cake" },
          { name: "Skillet Chocolate Chip Cookie", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Cookie" },
          { name: "Cheesecake", imageURL: "https://via.placeholder.com/200x200/FFF8DC/000000?text=Cheesecake" },
          { name: "Fried Oreos", imageURL: "https://via.placeholder.com/200x200/000000/FFFFFF?text=Fried+Oreos" },
          { name: "Sopapillas", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Sopapillas" },
          { name: "Churros", imageURL: "https://via.placeholder.com/200x200/FF8C00/FFFFFF?text=Churros" },
        ],
      };
    } else if (restaurantName.includes("texas") && restaurantName.includes("roadhouse")) {
      // Use Texas Roadhouse menu items - simplified list
      allMenuItems = {
        beverages: [
          { name: "Coca-Cola", imageURL: "https://via.placeholder.com/200x200/FF0000/FFFFFF?text=Coca-Cola" },
          { name: "Diet Coke", imageURL: "https://via.placeholder.com/200x200/000000/FFFFFF?text=Diet+Coke" },
          { name: "Sprite", imageURL: "https://via.placeholder.com/200x200/00FF00/000000?text=Sprite" },
          { name: "Dr Pepper", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=Dr+Pepper" },
          { name: "Iced Tea", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Iced+Tea" },
          { name: "Sweet Tea", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Sweet+Tea" },
          { name: "Lemonade", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Lemonade" },
          { name: "Fresh Brewed Iced Tea", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Iced+Tea" },
          { name: "Coffee", imageURL: "https://via.placeholder.com/200x200/3E2723/FFFFFF?text=Coffee" },
          { name: "Hot Tea", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Hot+Tea" },
          { name: "Root Beer", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Root+Beer" },
          { name: "Orange Juice", imageURL: "https://via.placeholder.com/200x200/FF8C00/FFFFFF?text=OJ" },
          { name: "Ice Water", imageURL: "https://via.placeholder.com/200x200/E3F2FD/000000?text=Water" },
          { name: "Bottled Water", imageURL: "https://via.placeholder.com/200x200/E3F2FD/000000?text=Bottled" },
        ],
        alcoholic_drinks: [
          { name: "Long Island Iced Tea", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=LIIT" },
          { name: "Margarita", imageURL: "https://via.placeholder.com/200x200/00FF00/000000?text=Margarita" },
          { name: "Strawberry Margarita", imageURL: "https://via.placeholder.com/200x200/FF1493/FFFFFF?text=Straw+Marg" },
          { name: "Beer - Domestic", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Beer" },
          { name: "Beer - Import", imageURL: "https://via.placeholder.com/200x200/FFA500/000000?text=Import+Beer" },
          { name: "Beer - Craft", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Craft+Beer" },
          { name: "House Wine - Red", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=Red+Wine" },
          { name: "House Wine - White", imageURL: "https://via.placeholder.com/200x200/FFE4B5/000000?text=White+Wine" },
          { name: "Whiskey Sour", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Whiskey+Sour" },
          { name: "Mojito", imageURL: "https://via.placeholder.com/200x200/98FB98/000000?text=Mojito" },
          { name: "Old Fashioned", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Old+Fashioned" },
          { name: "Texas Roadhouse Special", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=TR+Special" },
        ],
        appetizers: [
          { name: "Rattlesnake Bites", imageURL: "https://via.placeholder.com/200x200/FF4500/FFFFFF?text=Rattlesnake" },
          { name: "Cactus Blossom", imageURL: "https://via.placeholder.com/200x200/90EE90/000000?text=Cactus" },
          { name: "Tater Skins", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Tater+Skins" },
          { name: "Fried Pickles", imageURL: "https://via.placeholder.com/200x200/90EE90/000000?text=Fried+Pickles" },
          { name: "Boneless Wings", imageURL: "https://via.placeholder.com/200x200/FF4500/FFFFFF?text=Wings" },
          { name: "Loaded Potato Skins", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Loaded+Skins" },
          { name: "Chili Cheese Fries", imageURL: "https://via.placeholder.com/200x200/FF4500/FFFFFF?text=Chili+Fries" },
          { name: "Onion Rings", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Onion+Rings" },
          { name: "Mozzarella Sticks", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Mozz+Sticks" },
          { name: "Combo Appetizer", imageURL: "https://via.placeholder.com/200x200/FF6347/FFFFFF?text=Combo" },
        ],
        entrees: [
          { name: "6 oz. Sirloin", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=6oz+Steak" },
          { name: "8 oz. Sirloin", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=8oz+Steak" },
          { name: "11 oz. Sirloin", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=11oz+Steak" },
          { name: "Ribeye Steak - 12 oz.", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=12oz+Ribeye" },
          { name: "Ribeye Steak - 16 oz.", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=16oz+Ribeye" },
          { name: "Filet Medallions", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=Filet" },
          { name: "Porterhouse T-Bone", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=T-Bone" },
          { name: "Dallas Filet", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=Dallas+Filet" },
          { name: "Ft. Worth Ribeye", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=FtWorth+Ribeye" },
          { name: "Smothered Steak", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=Smothered" },
          { name: "Country Fried Sirloin", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Fried+Steak" },
          { name: "Grilled BBQ Chicken", imageURL: "https://via.placeholder.com/200x200/FF6347/FFFFFF?text=BBQ+Chicken" },
          { name: "Chicken Critters", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Critters" },
          { name: "Grilled Salmon", imageURL: "https://via.placeholder.com/200x200/FF69B4/FFFFFF?text=Salmon" },
          { name: "Grilled Pork Chops", imageURL: "https://via.placeholder.com/200x200/FF6347/FFFFFF?text=Pork+Chops" },
          { name: "Baby Back Ribs - Full Rack", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=Full+Ribs" },
          { name: "Baby Back Ribs - Half Rack", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=Half+Ribs" },
          { name: "Fall-Off-The-Bone Ribs", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=Fall+Ribs" },
          { name: "Road Kill", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=Road+Kill" },
          { name: "Chop Steak", imageURL: "https://via.placeholder.com/200x200/8B0000/FFFFFF?text=Chop+Steak" },
        ],
        sides: [
          { name: "Loaded Baked Potato", imageURL: "https://via.placeholder.com/200x200/FFF8DC/000000?text=Loaded+Potato" },
          { name: "Steak Fries", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Steak+Fries" },
          { name: "Sweet Potato", imageURL: "https://via.placeholder.com/200x200/FF8C00/FFFFFF?text=Sweet+Potato" },
          { name: "Rice Pilaf", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Rice+Pilaf" },
          { name: "Seasoned Rice", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Seasoned+Rice" },
          { name: "Fresh Steamed Broccoli", imageURL: "https://via.placeholder.com/200x200/90EE90/000000?text=Broccoli" },
          { name: "Fresh Corn", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Corn" },
          { name: "Side Salad", imageURL: "https://via.placeholder.com/200x200/90EE90/000000?text=Salad" },
          { name: "Caesar Salad", imageURL: "https://via.placeholder.com/200x200/90EE90/000000?text=Caesar" },
          { name: "House Salad", imageURL: "https://via.placeholder.com/200x200/90EE90/000000?text=House+Salad" },
          { name: "Mashed Potatoes", imageURL: "https://via.placeholder.com/200x200/FFF8DC/000000?text=Mashed" },
          { name: "Loaded Mashed Potatoes", imageURL: "https://via.placeholder.com/200x200/FFF8DC/000000?text=Loaded+Mashed" },
        ],
        desserts: [
          { name: "Big Ol' Brownie", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Brownie" },
          { name: "Strawberry Cheesecake", imageURL: "https://via.placeholder.com/200x200/FF1493/FFFFFF?text=Straw+Cheese" },
          { name: "Granny's Apple Classic", imageURL: "https://via.placeholder.com/200x200/FF8C00/FFFFFF?text=Apple+Classic" },
          { name: "Caramel Apple Goldrush", imageURL: "https://via.placeholder.com/200x200/FF8C00/FFFFFF?text=Goldrush" },
          { name: "Butter Cake", imageURL: "https://via.placeholder.com/200x200/FFD700/000000?text=Butter+Cake" },
          { name: "New York Style Cheesecake", imageURL: "https://via.placeholder.com/200x200/FFF8DC/000000?text=NY+Cheese" },
          { name: "Chocolate Chip Cookie", imageURL: "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Cookie" },
        ],
      };
    } else {
      console.log("Unknown restaurant type, cannot update images");
      return false;
    }

    // Update each menu item
    for (const docSnap of menuSnap.docs) {
      const itemData = docSnap.data();
      const itemName = itemData.name;
      
      // Find matching imageURL from our menu items
      let imageURL = null;
      for (const sectionItems of Object.values(allMenuItems)) {
        const match = sectionItems.find(item => item.name === itemName);
        if (match) {
          imageURL = match.imageURL;
          break;
        }
      }

      if (imageURL && !itemData.imageURL) {
        // Update the document with imageURL
        const itemRef = doc(db, "restaurants", restaurantId, "menu", docSnap.id);
        await updateDoc(itemRef, {
          imageURL: imageURL
        });
        updated++;
      } else if (itemData.imageURL) {
        skipped++;
      }
    }

    console.log(`✅ Updated ${updated} menu items with images. Skipped ${skipped} items that already had images.`);
    return true;
  } catch (error) {
    console.error("Error updating menu items with images:", error);
    return false;
  }
}

