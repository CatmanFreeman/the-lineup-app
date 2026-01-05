// src/components/MessageCenter.jsx

import React, { useState, useEffect, useCallback, useRef } from "react";
import { collection, query, where, getDocs, getDoc, addDoc, orderBy, limit, onSnapshot, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { db } from "../hooks/services/firebase";
import { useAuth } from "../context/AuthContext";
import "./MessageCenter.css";

const COMPANY_ID = "company-demo";

export default function MessageCenter({ employeeUid, restaurantId, employeeName }) {
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [recipients, setRecipients] = useState([]);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [newRecipient, setNewRecipient] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  // Load recipients - Employees can only message Restaurant Dashboard (not other employees)
  const loadRecipients = useCallback(async () => {
    if (!restaurantId) return;

    try {
      // Employees can only message the Restaurant Dashboard (manager/restaurant level)
      // Not other employees - this is enforced by only showing restaurant-level recipients
      const restaurantRef = doc(db, "restaurants", restaurantId);
      const restaurantSnap = await getDoc(restaurantRef);
      
      if (restaurantSnap.exists()) {
        const restaurantData = restaurantSnap.data();
        // Add restaurant as a recipient (represented by restaurantId)
        setRecipients([{
          uid: `restaurant-${restaurantId}`,
          name: restaurantData.name || "Restaurant Management",
          role: "Restaurant Dashboard",
          type: "restaurant"
        }]);
      }
    } catch (err) {
      console.error("Error loading recipients:", err);
    }
  }, [restaurantId]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!employeeUid || !restaurantId) {
      setLoading(false);
      return;
    }

    try {
      const conversationsRef = collection(
        db,
        "companies",
        COMPANY_ID,
        "restaurants",
        restaurantId,
        "messages"
      );

      // Get conversations where user is a participant
      const q = query(
        conversationsRef,
        where("participants", "array-contains", employeeUid),
        orderBy("lastMessageAt", "desc"),
        limit(20)
      );

      const snap = await getDocs(q);
      const convos = snap.docs.map((d) => {
        const data = d.data();
        const otherParticipant = data.participants.find((p) => p !== employeeUid);
        return {
          id: d.id,
          otherParticipant,
          otherParticipantName: data.participantNames?.[otherParticipant] || "Unknown",
          lastMessage: data.lastMessage || "",
          lastMessageAt: data.lastMessageAt,
          unreadCount: data.unreadCount?.[employeeUid] || 0,
        };
      });

      setConversations(convos);
    } catch (err) {
      console.error("Error loading conversations:", err);
    } finally {
      setLoading(false);
    }
  }, [employeeUid, restaurantId]);

  // Load messages for a conversation
  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;

    try {
      const messagesRef = collection(
        db,
        "companies",
        COMPANY_ID,
        "restaurants",
        restaurantId,
        "messages",
        conversationId,
        "messages"
      );

      const q = query(messagesRef, orderBy("createdAt", "asc"), limit(50));
      const snap = await getDocs(q);
      const messagesList = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setMessages(messagesList);

      // Mark as read
      const conversationRef = doc(
        db,
        "companies",
        COMPANY_ID,
        "restaurants",
        restaurantId,
        "messages",
        conversationId
      );
      await updateDoc(conversationRef, {
        [`unreadCount.${employeeUid}`]: 0,
      });

      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  }, [restaurantId, employeeUid]);

  // Send a new message
  const sendMessage = useCallback(async (text, recipientUid = null) => {
    if (!text.trim() || !employeeUid || !restaurantId) return;

    try {
      let conversationId = selectedConversation?.id;

      // If starting new conversation, create it
      if (!conversationId && recipientUid) {
        const conversationsRef = collection(
          db,
          "companies",
          COMPANY_ID,
          "restaurants",
          restaurantId,
          "messages"
        );

        const recipient = recipients.find((r) => r.uid === recipientUid);
        const newConvoRef = doc(conversationsRef);
        conversationId = newConvoRef.id;

        await addDoc(conversationsRef, {
          id: conversationId,
          participants: [employeeUid, recipientUid],
          participantNames: {
            [employeeUid]: employeeName || "You",
            [recipientUid]: recipient?.name || "Unknown",
          },
          lastMessage: text,
          lastMessageAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          unreadCount: {
            [employeeUid]: 0,
            [recipientUid]: 1,
          },
        });
      }

      // Add message to conversation
      if (conversationId) {
        const messagesRef = collection(
          db,
          "companies",
          COMPANY_ID,
          "restaurants",
          restaurantId,
          "messages",
          conversationId,
          "messages"
        );

        await addDoc(messagesRef, {
          senderUid: employeeUid,
          senderName: employeeName || "You",
          text: text.trim(),
          createdAt: serverTimestamp(),
        });

        // Update conversation
        const conversationRef = doc(
          db,
          "companies",
          COMPANY_ID,
          "restaurants",
          restaurantId,
          "messages",
          conversationId
        );

        await updateDoc(conversationRef, {
          lastMessage: text.trim(),
          lastMessageAt: serverTimestamp(),
          [`unreadCount.${recipientUid || selectedConversation?.otherParticipant}`]: 1,
        });

        setNewMessage("");
        setShowNewMessage(false);
        setNewRecipient("");
      }
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Failed to send message. Please try again.");
    }
  }, [employeeUid, restaurantId, employeeName, selectedConversation, recipients]);

  // Set up real-time listener for messages
  useEffect(() => {
    if (!selectedConversation?.id) return;

    const messagesRef = collection(
      db,
      "companies",
      COMPANY_ID,
      "restaurants",
      restaurantId,
      "messages",
      selectedConversation.id,
      "messages"
    );

    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(50));
    const unsubscribe = onSnapshot(q, (snap) => {
      const messagesList = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setMessages(messagesList);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    });

    return () => unsubscribe();
  }, [selectedConversation, restaurantId]);

  // Initial load
  useEffect(() => {
    loadRecipients();
    loadConversations();
  }, [loadRecipients, loadConversations]);

  // Handle new message form
  const handleNewMessageSubmit = (e) => {
    e.preventDefault();
    if (newMessage.trim() && newRecipient) {
      sendMessage(newMessage, newRecipient);
    }
  };

  // Handle reply
  const handleReplySubmit = (e) => {
    e.preventDefault();
    if (newMessage.trim() && selectedConversation) {
      sendMessage(newMessage);
    }
  };

  if (loading) {
    return (
      <div className="ed-card">
        <div className="ed-card-header">
          <h3>Messages</h3>
        </div>
        <div className="ed-card-body">
          <div className="mc-loading">Loading messages...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ed-card">
      <div className="ed-card-header">
        <h3>Messages</h3>
        <button
          className="mc-new-btn"
          onClick={() => setShowNewMessage(!showNewMessage)}
        >
          + New
        </button>
      </div>
      <div className="ed-card-body">
        {/* New Message Form */}
        {showNewMessage && (
          <div className="mc-new-message">
            <form onSubmit={handleNewMessageSubmit}>
              <select
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                className="mc-select"
                required
              >
                <option value="">Select recipient...</option>
                {recipients.map((r) => (
                  <option key={r.uid} value={r.uid}>
                    {r.name} ({r.role})
                  </option>
                ))}
              </select>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="mc-textarea"
                rows={3}
                required
              />
              <div className="mc-form-actions">
                <button type="submit" className="mc-send-btn">
                  Send
                </button>
                <button
                  type="button"
                  className="mc-cancel-btn"
                  onClick={() => {
                    setShowNewMessage(false);
                    setNewMessage("");
                    setNewRecipient("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Conversations List */}
        {!selectedConversation && (
          <div className="mc-conversations">
            {conversations.length === 0 ? (
              <div className="mc-empty">
                <div className="mc-empty-icon">💬</div>
                <p>No messages yet</p>
                <p className="mc-empty-sub">Start a conversation with a coworker!</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`mc-conversation-item ${conv.unreadCount > 0 ? "mc-conversation-item--unread" : ""}`}
                  onClick={() => {
                    setSelectedConversation(conv);
                    loadMessages(conv.id);
                  }}
                >
                  <div className="mc-conversation-name">{conv.otherParticipantName}</div>
                  <div className="mc-conversation-preview">{conv.lastMessage}</div>
                  {conv.unreadCount > 0 && (
                    <div className="mc-unread-badge">{conv.unreadCount}</div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Messages View */}
        {selectedConversation && (
          <div className="mc-messages-view">
            <div className="mc-messages-header">
              <button
                className="mc-back-btn"
                onClick={() => {
                  setSelectedConversation(null);
                  setMessages([]);
                }}
              >
                ← Back
              </button>
              <div className="mc-messages-title">
                {selectedConversation.otherParticipantName}
              </div>
            </div>
            <div className="mc-messages-list">
              {messages.map((msg) => {
                const isMe = msg.senderUid === employeeUid;
                return (
                  <div
                    key={msg.id}
                    className={`mc-message ${isMe ? "mc-message--me" : ""}`}
                  >
                    <div className="mc-message-text">{msg.text}</div>
                    <div className="mc-message-time">
                      {msg.createdAt?.toDate?.()?.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      }) || ""}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleReplySubmit} className="mc-message-form">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="mc-textarea"
                rows={2}
              />
              <button type="submit" className="mc-send-btn">
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}