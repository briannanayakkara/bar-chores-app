import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <p className="text-xl text-slate-400">Page not found</p>
        <div className="mt-6 flex gap-4 justify-center">
          <Link to="/login" className="text-accent hover:underline">Admin Login</Link>
          <Link to="/staff-login" className="text-accent hover:underline">Staff Login</Link>
        </div>
      </div>
    </div>
  );
}
