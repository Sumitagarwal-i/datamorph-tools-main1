const STORAGE_KEY = "datumint_admin_authed";

export const isAdminAuthed = () => {
  return localStorage.getItem(STORAGE_KEY) === "true";
};

export const adminLogin = (password: string) => {
  if (password !== "pinkriver") return false;
  localStorage.setItem(STORAGE_KEY, "true");
  return true;
};

export const adminLogout = () => {
  localStorage.removeItem(STORAGE_KEY);
};
