import React from "react";
import { useNavigate } from "react-router-dom";
import "./AccountType.css";

export default function AccountType() {
  const navigate = useNavigate();

  return (
    <div className="account-type-page">
      <h1>Create Account</h1>

      <div className="account-type-options">
        <button onClick={() => navigate("/signup/diner")}>
          Create Diner Account
        </button>

        <button onClick={() => navigate("/signup/employee")}>
          Create Employee Account
        </button>

        <button onClick={() => navigate("/signup/company")}>
          Create Company Account
        </button>
      </div>
    </div>
  );
}
