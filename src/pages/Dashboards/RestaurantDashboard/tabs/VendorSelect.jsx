// src/pages/Dashboards/RestaurantDashboard/tabs/VendorSelect.jsx

import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";

export default function VendorSelect({ companyId, value, onChange }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadVendors() {
      const ref = collection(db, "companies", companyId, "vendors");
      const snap = await getDocs(ref);
      setVendors(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      );
      setLoading(false);
    }
    loadVendors();
  }, [companyId]);

  if (loading) {
    return <div>Loading vendors…</div>;
  }

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select vendor</option>
      {vendors.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
        </option>
      ))}
    </select>
  );
}
