// src/pages/Dashboards/RestaurantDashboard/tabs/MessagingTab.jsx

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../../../context/AuthContext";
import {
  getConversations,
  getMessages,
  sendMessage,
  markConversationAsRead,
  subscribeToMessages,
  getRecipients,
} from "../../../../utils/messagingService";
import "./MessagingTab.css";

export default function MessagingTab() {
  const { restaurantId } = useParams();
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [recipients, setRecipients] = useState([]);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [newRecipient, setNewRecipient] = useState(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversations
  useEffect(() => {
    if (!restaurantId || !currentUser) return;

    const loadConversations = async () => {
      try {
        const convos = await getConversations({
          userId: currentUser.uid,
          userType: "restaurant",
          restaurantId: restaurantId,
          companyId: "company-demo",
        });
        setConversations(convos);
      } catch (error) {
        console.error("Error loading conversations:", error);
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, [restaurantId, currentUser]);

  // Load recipients
  useEffect(() => {
    if (!restaurantId || !currentUser) return;

    const loadRecipients = async () => {
      try {
        const recs = await getRecipients({
          userId: currentUser.uid,
          userType: "restaurant",
          restaurantId: restaurantId,
          companyId: "company-demo",
        });
        setRecipients(recs);
      } catch (error) {
        console.error("Error loading recipients:", error);
      }
    };

    loadRecipients();
  }, [restaurantId, currentUser]);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConversation || !restaurantId || !currentUser) return;

    const loadMessages = async () => {
      try {
        const msgs = await getMessages({
          conversationId: selectedConversation.id,
          senderType: "restaurant",
          restaurantId: restaurantId,
          companyId: "company-demo",
        });
        setMessages(msgs);

        // Mark as read
        await markConversationAsRead({
          conversationId: selectedConversation.id,
          userId: currentUser.uid,
          senderType: "restaurant",
          restaurantId: restaurantId,
          companyId: "company-demo",
        });
      } catch (error) {
        console.error("Error loading messages:", error);
      }
    };

    loadMessages();

    // Subscribe to new messages
    const unsubscribe = subscribeToMessages({
      conversationId: selectedConversation.id,
      senderType: "restaurant",
      restaurantId: restaurantId,
      companyId: "company-demo",
      callback: (newMessages) => {
        setMessages(newMessages);
      },
    });

    return () => unsubscribe();
  }, [selectedConversation, restaurantId, currentUser]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUser) return;

    try {
      const otherParticipant = selectedConversation.participants.find(
        (p) => p !== currentUser.uid
      );
      const otherParticipantName =
        selectedConversation.participantNames?.[otherParticipant] ||
        "Unknown";
      const otherParticipantType =
        selectedConversation.participantTypes?.[otherParticipant] || "employee";

      await sendMessage({
        senderId: currentUser.uid,
        senderName: "Restaurant Management",
        senderType: "restaurant",
        recipientId: otherParticipant,
        recipientName: otherParticipantName,
        recipientType: otherParticipantType,
        text: newMessage,
        restaurantId: restaurantId,
        companyId: "company-demo",
        conversationId: selectedConversation.id,
      });

      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleStartNewConversation = async () => {
    if (!newRecipient || !newMessage.trim() || !currentUser) return;

    try {
      const conversationId = await sendMessage({
        senderId: currentUser.uid,
        senderName: "Restaurant Management",
        senderType: "restaurant",
        recipientId: newRecipient.id,
        recipientName: newRecipient.name,
        recipientType: newRecipient.type,
        text: newMessage,
        restaurantId: restaurantId,
        companyId: "company-demo",
      });

      // Reload conversations
      const convos = await getConversations({
        userId: currentUser.uid,
        userType: "restaurant",
        restaurantId: restaurantId,
        companyId: "company-demo",
      });
      setConversations(convos);

      // Select the new conversation
      const newConvo = convos.find((c) => c.id === conversationId);
      if (newConvo) {
        setSelectedConversation(newConvo);
      }

      setNewMessage("");
      setNewRecipient(null);
      setShowNewMessage(false);
    } catch (error) {
      console.error("Error starting conversation:", error);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="messaging-tab">
        <div className="messaging-loading">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="messaging-tab">
      <div className="messaging-container">
        {/* Conversations List */}
        <div className="messaging-sidebar">
          <div className="messaging-header">
            <h2>Messages</h2>
            <button
              className="messaging-new-btn"
              onClick={() => setShowNewMessage(!showNewMessage)}
            >
              + New
            </button>
          </div>

          {showNewMessage && (
            <div className="messaging-new-conversation">
              <select
                className="messaging-recipient-select"
                value={newRecipient?.id || ""}
                onChange={(e) => {
                  const recipient = recipients.find((r) => r.id === e.target.value);
                  setNewRecipient(recipient);
                }}
              >
                <option value="">Select recipient...</option>
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.type === "company" ? "Company" : r.type === "employee" ? "Employee" : "Restaurant"})
                  </option>
                ))}
              </select>
              <textarea
                className="messaging-new-textarea"
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={3}
              />
              <div className="messaging-new-actions">
                <button
                  className="messaging-send-btn"
                  onClick={handleStartNewConversation}
                  disabled={!newRecipient || !newMessage.trim()}
                >
                  Send
                </button>
                <button
                  className="messaging-cancel-btn"
                  onClick={() => {
                    setShowNewMessage(false);
                    setNewRecipient(null);
                    setNewMessage("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="messaging-conversations-list">
            {conversations.length === 0 ? (
              <div className="messaging-empty">No conversations yet</div>
            ) : (
              conversations.map((conv) => {
                const otherParticipant = conv.participants.find(
                  (p) => p !== currentUser?.uid
                );
                const otherName = conv.participantNames?.[otherParticipant] || "Unknown";
                const unreadCount = conv.unreadCount?.[currentUser?.uid] || 0;

                return (
                  <div
                    key={conv.id}
                    className={`messaging-conversation-item ${
                      selectedConversation?.id === conv.id ? "active" : ""
                    } ${unreadCount > 0 ? "unread" : ""}`}
                    onClick={() => setSelectedConversation(conv)}
                  >
                    <div className="messaging-conversation-name">{otherName}</div>
                    <div className="messaging-conversation-preview">
                      {conv.lastMessage || "No messages"}
                    </div>
                    {unreadCount > 0 && (
                      <div className="messaging-unread-badge">{unreadCount}</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Messages View */}
        <div className="messaging-main">
          {selectedConversation ? (
            <>
              <div className="messaging-messages-header">
                <h3>
                  {
                    selectedConversation.participantNames[
                      selectedConversation.participants.find(
                        (p) => p !== currentUser?.uid
                      )
                    ]
                  }
                </h3>
              </div>

              <div className="messaging-messages-list">
                {messages.map((msg) => {
                  const isMe = msg.senderId === currentUser?.uid;
                  return (
                    <div
                      key={msg.id}
                      className={`messaging-message ${isMe ? "me" : "other"}`}
                    >
                      <div className="messaging-message-text">{msg.text}</div>
                      <div className="messaging-message-time">
                        {formatTime(msg.createdAt)}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="messaging-input-area">
                <textarea
                  className="messaging-input"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  rows={3}
                />
                <button
                  className="messaging-send-btn"
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="messaging-empty-main">
              <p>Select a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}









