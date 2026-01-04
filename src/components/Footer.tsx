
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ContactModal } from "./ContactModal";


export const Footer = () => {
  const navigate = useNavigate();
  const [contactModalOpen, setContactModalOpen] = useState(false);

  return (
    <footer className="border-t border-[#EAEAEA] dark:border-[#1E1E1E] py-8 sm:py-12 bg-white dark:bg-[#0F0F0F]">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src="/Logo.png" alt="DatumInt Logo" className="h-6 w-6" />
              <span className="font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">DatumInt</span>
            </div>
            <p className="text-sm text-[#6B6B6B] dark:text-[#A8A8A8]">
              Inspect files before they break your production.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => navigate('/inspect')}
                  className="text-sm text-[#6B6B6B] dark:text-[#A8A8A8] hover:text-[#1A1A1A] dark:hover:text-[#E8E8E8] transition-colors"
                >
                  Inspect
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/tools')}
                  className="text-sm text-[#6B6B6B] dark:text-[#A8A8A8] hover:text-[#1A1A1A] dark:hover:text-[#E8E8E8] transition-colors"
                >
                  Tools
                </button>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/blog"
                  className="text-sm text-[#6B6B6B] dark:text-[#A8A8A8] hover:text-[#1A1A1A] dark:hover:text-[#E8E8E8] transition-colors"
                >
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Only */}
          <div>
            <h3 className="font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">Contact</h3>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => setContactModalOpen(true)}
                  className="text-sm text-[#6B6B6B] dark:text-[#A8A8A8] hover:text-[#1A1A1A] dark:hover:text-[#E8E8E8] transition-colors"
                >
                  Contact
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-[#EAEAEA] dark:border-[#2A2A2A] pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs sm:text-sm text-[#6B6B6B] dark:text-[#8B8B8B]">
            © 2026 DatumInt. Made with ❤️ for data quality.
          </p>
          <p className="text-xs sm:text-sm text-[#6B6B6B] dark:text-[#8B8B8B]">
            • Privacy first • No data collection • Files processed securely
          </p>
        </div>
      </div>
      <ContactModal open={contactModalOpen} onOpenChange={setContactModalOpen} />
    </footer>
  );
};
