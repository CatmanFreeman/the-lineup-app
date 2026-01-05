// src/pages/Dashboards/RestaurantDashboard/tabs/StaffManagementTab.jsx

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";
import "./OverviewTab.css";

const ROLE_OPTIONS = ["Front of House", "Back of House"];

const SUBROLE_OPTIONS = {
  "Front of House": ["Host", "Server", "Bartender"],
  "Back of House": ["Grill", "Fry", "Saute", "Salad"],
};

export default function StaffManagementTab() {
  const { restaurantId } = useParams();
  const companyId = "company-demo";

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  // -----------------------------
  // Load staff
  // -----------------------------
  async function loadStaff() {
    setLoading(true);
    try {
      const ref = collection(
        db,
        "companies",
        companyId,
        "restaurants",
        restaurantId,
        "staff"
      );
      const snap = await getDocs(ref);

      const rows = snap.docs.map((d) => {
        const data = d.data() || {};
        return {
          id: d.id,
          uid: data.uid || d.id,
          name: data.name || d.id,
          role: data.role || "Front of House",
          subRole: data.subRole || "",
          active: data.active !== false,
        };
      });

      setStaff(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
  }, [restaurantId]);

  // -----------------------------
  // Update helper
  // -----------------------------
  async function updateStaffField(staffId, updates) {
    setSavingId(staffId);
    try {
      const ref = doc(
        db,
        "companies",
        companyId,
        "restaurants",
        restaurantId,
        "staff",
        staffId
      );

      await updateDoc(ref, {
        ...updates,
        updatedAt: serverTimestamp(),
      });

      setStaff((prev) =>
        prev.map((s) =>
          s.id === staffId ? { ...s, ...updates } : s
        )
      );
    } finally {
      setSavingId(null);
    }
  }

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div className="overview-wrapper">
      <section className="overview-section">
        <h2 className="section-title">Staff Management</h2>

        {loading ? (
          <div className="metric-subtext">Loading staff…</div>
        ) : staff.length === 0 ? (
          <div className="metric-subtext">No staff found</div>
        ) : (
          <table style={{ width: "100%", marginTop: 16 }}>
            <thead>
              <tr>
                <th align="left">Name</th>
                <th align="left">Role</th>
                <th align="left">Sub-Role</th>
                <th align="center">Active</th>
                <th align="left">UID</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const subRoles = SUBROLE_OPTIONS[s.role] || [];

                return (
                  <tr key={s.id}>
                    <td>{s.name}</td>

                    {/* ROLE */}
                    <td>
                      <select
                        value={s.role}
                        disabled={savingId === s.id}
                        onChange={(e) => {
                          const nextRole = e.target.value;
                          const validSubs =
                            SUBROLE_OPTIONS[nextRole] || [];
                          updateStaffField(s.id, {
                            role: nextRole,
                            subRole: validSubs.includes(s.subRole)
                              ? s.subRole
                              : validSubs[0] || "",
                          });
                        }}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* SUBROLE */}
                    <td>
                      <select
                        value={s.subRole}
                        disabled={savingId === s.id}
                        onChange={(e) =>
                          updateStaffField(s.id, {
                            subRole: e.target.value,
                          })
                        }
                      >
                        {subRoles.map((sr) => (
                          <option key={sr} value={sr}>
                            {sr}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* ACTIVE */}
                    <td align="center">
                      <input
                        type="checkbox"
                        checked={s.active}
                        disabled={savingId === s.id}
                        onChange={(e) =>
                          updateStaffField(s.id, {
                            active: e.target.checked,
                          })
                        }
                      />
                    </td>

                    {/* UID */}
                    <td style={{ opacity: 0.75, fontSize: 13 }}>
                      {s.uid}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
