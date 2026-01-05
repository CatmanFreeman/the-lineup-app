// src/pages/Store/StorePage.jsx

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getStoreItems, STORE_ITEM_TYPE } from "../../utils/storeService";
import { getPointsBalance } from "../../utils/pointsService";
import { purchaseStoreItem } from "../../utils/storeService";
import PointsDisplay from "../../components/PointsDisplay";
import "./StorePage.css";

export default function StorePage() {
  const { currentUser } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [selectedType, setSelectedType] = useState(null);
  const [purchasing, setPurchasing] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (currentUser) {
      loadItems();
      loadPointsBalance();
    }
  }, [currentUser, selectedType]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const storeItems = await getStoreItems({
        type: selectedType,
      });
      setItems(storeItems);
    } catch (error) {
      console.error("Error loading store items:", error);
      setError("Failed to load store items");
    } finally {
      setLoading(false);
    }
  };

  const loadPointsBalance = async () => {
    if (!currentUser) return;
    try {
      const balance = await getPointsBalance(currentUser.uid);
      setPointsBalance(balance.total || 0);
    } catch (error) {
      console.error("Error loading points balance:", error);
    }
  };

  const handlePurchase = async (item) => {
    if (!currentUser) {
      setError("Please log in to make a purchase");
      return;
    }

    if (pointsBalance < item.pointsCost) {
      setError("Insufficient points");
      return;
    }

    if (!window.confirm(`Purchase ${item.name} for ${item.pointsCost} points?`)) {
      return;
    }

    setPurchasing(item.id);
    setError(null);
    setSuccess(null);

    try {
      await purchaseStoreItem({
        userId: currentUser.uid,
        itemId: item.id,
        quantity: 1,
      });

      setSuccess(`Successfully purchased ${item.name}!`);
      await loadPointsBalance();
      await loadItems();
    } catch (error) {
      console.error("Error purchasing item:", error);
      setError(error.message || "Failed to purchase item");
    } finally {
      setPurchasing(null);
    }
  };

  const filterTypes = [
    { value: null, label: "All Items" },
    { value: STORE_ITEM_TYPE.GIFT_CARD, label: "Gift Cards" },
    { value: STORE_ITEM_TYPE.EXPERIENCE, label: "Experiences" },
    { value: STORE_ITEM_TYPE.PRODUCT, label: "Products" },
  ];

  return (
    <div className="store-page">
      <Link to="/" className="store-back-link">← Back</Link>
      <div className="store-container">
        <div className="store-header">
          <h1>Lineup Store</h1>
          <p className="store-subtitle">
            Exchange your Lineup Points for gift cards, experiences, and more!
          </p>
          {currentUser && (
            <div className="store-points-display">
              <PointsDisplay size="large" />
            </div>
          )}
        </div>

        {!currentUser && (
          <div className="store-login-prompt">
            <p>Please log in to browse and purchase items</p>
          </div>
        )}

        {error && (
          <div className="store-message store-error">
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {success && (
          <div className="store-message store-success">
            {success}
            <button onClick={() => setSuccess(null)}>×</button>
          </div>
        )}

        <div className="store-filters">
          {filterTypes.map((filter) => (
            <button
              key={filter.value || "all"}
              className={`store-filter-btn ${selectedType === filter.value ? "active" : ""}`}
              onClick={() => setSelectedType(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="store-loading">Loading store items...</div>
        ) : items.length === 0 ? (
          <div className="store-empty">
            <p>No items available at this time.</p>
            <p className="store-empty-subtitle">
              Check back soon for gift cards and experiences!
            </p>
          </div>
        ) : (
          <div className="store-items-grid">
            {items.map((item) => (
              <div key={item.id} className="store-item-card">
                {item.imageUrl && (
                  <div className="store-item-image">
                    <img src={item.imageUrl} alt={item.name} />
                  </div>
                )}
                <div className="store-item-content">
                  <div className="store-item-type">{item.type.replace("_", " ").toUpperCase()}</div>
                  <h3 className="store-item-name">{item.name}</h3>
                  <p className="store-item-description">{item.description}</p>
                  {item.giftCardValue && (
                    <div className="store-item-value">
                      Value: ${item.giftCardValue}
                    </div>
                  )}
                  <div className="store-item-footer">
                    <div className="store-item-cost">
                      <span className="store-item-points">{item.pointsCost}</span>
                      <span className="store-item-points-label">points</span>
                    </div>
                    {item.quantity !== null && (
                      <div className="store-item-stock">
                        {item.availableQuantity > 0
                          ? `${item.availableQuantity} left`
                          : "Sold out"}
                      </div>
                    )}
                  </div>
                  <button
                    className="store-item-purchase-btn"
                    onClick={() => handlePurchase(item)}
                    disabled={
                      purchasing === item.id ||
                      !currentUser ||
                      pointsBalance < item.pointsCost ||
                      (item.quantity !== null && item.availableQuantity === 0)
                    }
                  >
                    {purchasing === item.id
                      ? "Processing..."
                      : pointsBalance < item.pointsCost
                      ? "Insufficient Points"
                      : item.quantity !== null && item.availableQuantity === 0
                      ? "Sold Out"
                      : "Purchase"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

