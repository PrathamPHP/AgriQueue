import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, ArrowLeft, Home, Shield, Briefcase } from 'lucide-react';
import { Button } from './Button';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[500px] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-card p-6 sm:p-8 shadow-card text-center space-y-4 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#166534] flex items-center justify-center mx-auto border border-emerald-100 shadow-subtle">
          <FileQuestion className="w-8 h-8" />
        </div>

        <div>
          <div className="text-3xl font-black text-[#166534] tracking-tight">404</div>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
            Page Not Found / पृष्ठ उपलब्ध नहीं है
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
            The route or resource you requested is not available on the official portal. Please return to your designated dashboard.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <Button
            variant="primary"
            onClick={() => navigate('/farmer/dashboard')}
            icon={<Home className="w-4 h-4" />}
            className="w-full"
          >
            Farmer Dashboard
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/officer/dashboard')}
              icon={<Briefcase className="w-3.5 h-3.5" />}
            >
              Officer Portal
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/dashboard')}
              icon={<Shield className="w-3.5 h-3.5" />}
            >
              Admin Command
            </Button>
          </div>

          <button
            onClick={() => navigate(-1)}
            className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go back to previous page</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
