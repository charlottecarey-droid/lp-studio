export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center px-6"
      style={{ background: "#000", color: "#F5F5F5" }}
    >
      <div
        className="text-8xl font-bold mb-4"
        style={{ fontFamily: "'Inter Tight', sans-serif", color: "#D4F542" }}
      >
        404
      </div>
      <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
        Page Not Found
      </h1>
      <p className="text-gray-400 text-sm mb-8">
        The page you're looking for doesn't exist.
      </p>
      <a
        href={import.meta.env.BASE_URL || "/"}
        className="px-6 py-3 rounded-full text-sm font-bold transition-all"
        style={{ background: "#D4F542", color: "#000", fontFamily: "'Inter Tight', sans-serif" }}
        onMouseEnter={e => (e.currentTarget.style.background = "#d6f54a")}
        onMouseLeave={e => (e.currentTarget.style.background = "#D4F542")}
      >
        Back to Home
      </a>
    </div>
  );
}
