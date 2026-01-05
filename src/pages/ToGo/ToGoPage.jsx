// src/pages/ToGo/ToGoPage.jsx
//
// TO-GO ORDER PAGE
//
// Main page for placing To-Go orders
// - Display restaurant menu
// - Add items to cart
// - Proceed to checkout

import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../hooks/services/firebase";
import { loadRestaurantMenu, getAllMenuItems } from "../../utils/menuService";
import "./ToGoPage.css";

export default function ToGoPage() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState({
    beverages: [],
    alcoholic_drinks: [],
    appetizers: [],
    entrees: [],
    sides: [],
    desserts: [],
  });
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("entrees");

  const MENU_SECTIONS = [
    { key: "appetizers", label: "Appetizers" },
    { key: "entrees", label: "Entrees" },
    { key: "sides", label: "Sides" },
    { key: "beverages", label: "Beverages" },
    { key: "alcoholic_drinks", label: "Drinks" },
    { key: "desserts", label: "Desserts" },
  ];

  useEffect(() => {
    if (!restaurantId) {
      setError("Restaurant ID required");
      setLoading(false);
      return;
    }

    loadRestaurantData();
  }, [restaurantId]);

  async function loadRestaurantData() {
    try {
      setLoading(true);
      setError("");

      // Load restaurant
      const restaurantRef = doc(db, "restaurants", restaurantId);
      const restaurantSnap = await getDoc(restaurantRef);

      if (!restaurantSnap.exists()) {
        setError("Restaurant not found");
        setLoading(false);
        return;
      }

      setRestaurant({
        id: restaurantSnap.id,
        ...restaurantSnap.data(),
      });

      // Load menu
      const menuData = await loadRestaurantMenu(restaurantId);
      setMenu(menuData);

      // Load cart from localStorage
      const savedCart = localStorage.getItem(`togo_cart_${restaurantId}`);
      if (savedCart) {
        try {
          setCart(JSON.parse(savedCart));
        } catch (e) {
          console.error("Error loading cart from localStorage:", e);
        }
      }
    } catch (err) {
      console.error("Error loading restaurant data:", err);
      setError("Failed to load restaurant menu");
    } finally {
      setLoading(false);
    }
  }

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (restaurantId && cart.length > 0) {
      localStorage.setItem(`togo_cart_${restaurantId}`, JSON.stringify(cart));
    } else if (restaurantId && cart.length === 0) {
      localStorage.removeItem(`togo_cart_${restaurantId}`);
    }
  }, [cart, restaurantId]);

  const addToCart = (menuItem) => {
    if (!menuItem.available) {
      setError("This item is currently unavailable");
      return;
    }

    const existingItem = cart.find((item) => item.menuItemId === menuItem.id);

    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.menuItemId === menuItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          menuItemId: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          quantity: 1,
          specialInstructions: "",
        },
      ]);
    }
  };

  const removeFromCart = (menuItemId) => {
    setCart(cart.filter((item) => item.menuItemId !== menuItemId));
  };

  const updateCartItemQuantity = (menuItemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(menuItemId);
      return;
    }

    setCart(
      cart.map((item) =>
        item.menuItemId === menuItemId ? { ...item, quantity } : item
      )
    );
  };

  const updateCartItemInstructions = (menuItemId, instructions) => {
    setCart(
      cart.map((item) =>
        item.menuItemId === menuItemId
          ? { ...item, specialInstructions: instructions }
          : item
      )
    );
  };

  const getCartTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * 0.08; // 8% tax (configurable)
    return {
      subtotal,
      tax,
      total: subtotal + tax,
    };
  };

  const handleCheckout = () => {
    if (!currentUser) {
      navigate(`/login?redirect=/togo/${restaurantId}`);
      return;
    }

    if (cart.length === 0) {
      setError("Your cart is empty");
      return;
    }

    // Navigate to checkout with cart data
    navigate(`/togo/${restaurantId}/checkout`, {
      state: { cart, restaurant },
    });
  };

  if (loading) {
    return (
      <div className="togo-page">
        <div className="togo-loading">Loading menu...</div>
      </div>
    );
  }

  if (error && !restaurant) {
    return (
      <div className="togo-page">
        <div className="togo-error">{error}</div>
        <Link to="/" className="togo-back-link">
          Back to Home
        </Link>
      </div>
    );
  }

  const totals = getCartTotal();
  const activeMenuItems = menu[activeSection] || [];

  return (
    <div className="togo-page">
      <div className="togo-header">
        <Link to={`/company/${restaurantId}`} className="togo-back-link">
          ← Back to Restaurant
        </Link>
        <h1 className="togo-restaurant-name">{restaurant?.name || "Restaurant"}</h1>
        <p className="togo-restaurant-subtitle">Order To-Go</p>
      </div>

      <div className="togo-content">
        <div className="togo-menu-section">
          {/* Menu Section Tabs */}
          <div className="togo-menu-tabs">
            {MENU_SECTIONS.map((section) => {
              const itemCount = menu[section.key]?.length || 0;
              if (itemCount === 0) return null;

              return (
                <button
                  key={section.key}
                  className={`togo-menu-tab ${activeSection === section.key ? "active" : ""}`}
                  onClick={() => setActiveSection(section.key)}
                >
                  {section.label}
                  <span className="togo-menu-tab-count">({itemCount})</span>
                </button>
              );
            })}
          </div>

          {/* Menu Items */}
          <div className="togo-menu-items">
            {activeMenuItems.length === 0 ? (
              <div className="togo-empty-section">
                No items available in this section
              </div>
            ) : (
              activeMenuItems.map((item) => (
                <div key={item.id} className="togo-menu-item">
                  {item.imageURL && (
                    <img
                      src={item.imageURL}
                      alt={item.name}
                      className="togo-menu-item-image"
                    />
                  )}
                  <div className="togo-menu-item-content">
                    <h3 className="togo-menu-item-name">{item.name}</h3>
                    {item.description && (
                      <p className="togo-menu-item-description">{item.description}</p>
                    )}
                    <div className="togo-menu-item-footer">
                      <span className="togo-menu-item-price">${item.price.toFixed(2)}</span>
                      <button
                        className="togo-add-button"
                        onClick={() => addToCart(item)}
                        disabled={!item.available}
                      >
                        {item.available ? "+ Add" : "Unavailable"}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cart Sidebar */}
        <div className="togo-cart-sidebar">
          <div className="togo-cart-header">
            <h2>Your Order</h2>
            {cart.length > 0 && (
              <button
                className="togo-cart-clear"
                onClick={() => {
                  if (window.confirm("Clear your cart?")) {
                    setCart([]);
                  }
                }}
              >
                Clear
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="togo-cart-empty">
              <p>Your cart is empty</p>
              <p className="togo-cart-empty-hint">Add items from the menu to get started</p>
            </div>
          ) : (
            <>
              <div className="togo-cart-items">
                {cart.map((item) => (
                  <div key={item.menuItemId} className="togo-cart-item">
                    <div className="togo-cart-item-header">
                      <span className="togo-cart-item-name">{item.name}</span>
                      <button
                        className="togo-cart-item-remove"
                        onClick={() => removeFromCart(item.menuItemId)}
                      >
                        ×
                      </button>
                    </div>
                    <div className="togo-cart-item-controls">
                      <div className="togo-quantity-controls">
                        <button
                          className="togo-quantity-btn"
                          onClick={() => updateCartItemQuantity(item.menuItemId, item.quantity - 1)}
                        >
                          −
                        </button>
                        <span className="togo-quantity-value">{item.quantity}</span>
                        <button
                          className="togo-quantity-btn"
                          onClick={() => updateCartItemQuantity(item.menuItemId, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                      <span className="togo-cart-item-price">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                    <textarea
                      className="togo-cart-item-instructions"
                      placeholder="Special instructions (optional)"
                      value={item.specialInstructions}
                      onChange={(e) =>
                        updateCartItemInstructions(item.menuItemId, e.target.value)
                      }
                      maxLength={200}
                    />
                  </div>
                ))}
              </div>

              <div className="togo-cart-totals">
                <div className="togo-cart-total-row">
                  <span>Subtotal</span>
                  <span>${totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="togo-cart-total-row">
                  <span>Tax</span>
                  <span>${totals.tax.toFixed(2)}</span>
                </div>
                <div className="togo-cart-total-row togo-cart-total-final">
                  <span>Total</span>
                  <span>${totals.total.toFixed(2)}</span>
                </div>
              </div>

              <button className="togo-checkout-button" onClick={handleCheckout}>
                Proceed to Checkout
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="togo-error-message" onClick={() => setError("")}>
          {error} (click to dismiss)
        </div>
      )}
    </div>
  );
}








