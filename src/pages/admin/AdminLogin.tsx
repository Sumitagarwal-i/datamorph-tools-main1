import { useState } from "react";
import { adminLogin } from "@/lib/adminAuth";

type Props = {
  onSuccess: () => void;
};

const AdminLogin = ({ onSuccess }: Props) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[14px] bg-white border border-black/[0.06] shadow-[0_4px_12px_rgba(0,0,0,0.04)] p-7">
        <div className="text-sm text-[#94A3B8]">Datumint</div>
        <h1 className="mt-2 text-2xl font-semibold text-[#0F172A]">Admin</h1>
        <p className="mt-2 text-sm text-[#64748B]">
          Enter the admin password to manage blog posts.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const ok = adminLogin(password);
            if (!ok) {
              setError("Invalid password.");
              return;
            }
              onSuccess();
          }}
        >
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full rounded-xl bg-white border border-black/[0.08] px-4 py-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 focus:border-[#06B6D4]/60"
              autoFocus
            />
            {error ? (
              <div className="mt-2 text-sm text-red-600">{error}</div>
            ) : null}
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-[#0F172A] text-white px-4 py-3 text-sm font-semibold transition-all duration-300 hover:opacity-95"
          >
            Login
          </button>

          <div className="text-xs text-[#94A3B8]">
            This route is not linked publicly.
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
