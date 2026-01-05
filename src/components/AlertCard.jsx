export default function AlertCard({ alerts = [] }) {
  if (!alerts.length) {
    return (
      <div className="alert-card">
        <strong>Staffing Alerts</strong>
        <p>No alerts for this shift.</p>
      </div>
    );
  }

  return (
    <div className="alert-card">
      <strong>Staffing Alerts</strong>
      {alerts.map((alert, index) => (
        <div key={index}>
          {alert}
        </div>
      ))}
    </div>
  );
}
