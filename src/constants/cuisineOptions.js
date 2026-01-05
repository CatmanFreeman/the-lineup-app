// src/constants/cuisineOptions.js
// Centralized cuisine options for the entire app
// This ensures consistency across HomePage dropdown, Profile Settings, and all other components

export const CUISINE_OPTIONS = [
  "American",
  "Barbecue",
  "Bistro",
  "Breakfast",
  "Brunch",
  "Burgers",
  "Café",
  "Chinese",
  "Desserts",
  "Indian",
  "Italian",
  "Mediterranean",
  "Mexican",
  "Middle Eastern",
  "Pizza",
  "Sandwiches",
  "Seafood",
  "Soup",
  "Salads",
  "Southern",
  "Soul Food",
  "Steakhouse",
  "Sushi",
  "Tapas",
  "Thai",
  "Vegan",
  "Vegetarian",
  "Venezuelan",
  "Vietnamese",
];

// For HomePage dropdown - includes "All Cuisines" option
export const HOME_PAGE_CUISINE_OPTIONS = [
  "All Cuisines",
  ...CUISINE_OPTIONS,
];

