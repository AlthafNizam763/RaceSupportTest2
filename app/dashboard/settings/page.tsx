"use client";

import { useEffect, useState } from "react";
import { useRealtimeCollection } from "../../../hooks/useRealtimeCollection";
import { useAuth } from "../../../hooks/useAuth";
import { updateDocument, createDocument } from "../../../lib/firebase/firestore";
import { 
  Settings, 
  Globe, 
  Mail, 
  Phone, 
  MapPin, 
  Instagram, 
  Linkedin, 
  Facebook, 
  Twitter,
  Save,
  Loader2,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function SettingsPage() {
  const { data: settingsData, loading } = useRealtimeCollection("settings");
  const { user } = useAuth();
  const isViewer = user?.role === "viewer";
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    siteName: "RACE Portal",
    contactEmail: "info@raceindia.org",
    contactPhone: "+91 80000 00000",
    address: "Kerala, India",
    instagram: "",
    linkedin: "",
    facebook: "",
    twitter: "",
  });

  useEffect(() => {
    if (settingsData && settingsData.length > 0) {
      const activeSettings = settingsData[0];
      setFormData({
        siteName: activeSettings.siteName || "",
        contactEmail: activeSettings.contactEmail || "",
        contactPhone: activeSettings.contactPhone || "",
        address: activeSettings.address || "",
        instagram: activeSettings.instagram || "",
        linkedin: activeSettings.linkedin || "",
        facebook: activeSettings.facebook || "",
        twitter: activeSettings.twitter || "",
      });
    }
  }, [settingsData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (settingsData && settingsData.length > 0) {
        await updateDocument("settings", settingsData[0].id, formData);
      } else {
        await createDocument("settings", formData);
      }
      toast.success("Settings saved successfully!");
    } catch (err: any) {
      toast.error("Failed to save settings: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="text-white p-8 animate-pulse"><Loader2 className="animate-spin w-5 h-5"/> Loading settings...</div>;

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary" />
          Site Settings
        </h1>
        <p className="text-muted-foreground">Manage global website configuration and branding.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Global Branding */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-6 rounded-2xl border border-white/5"
        >
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            General Branding
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Site Name</label>
              <input 
                type="text" 
                value={formData.siteName}
                onChange={e => setFormData({...formData, siteName: e.target.value})}
                className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Contact Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="email" 
                  value={formData.contactEmail}
                  onChange={e => setFormData({...formData, contactEmail: e.target.value})}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-primary/50 outline-none transition"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Contact Info */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel p-6 rounded-2xl border border-white/5"
        >
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Phone className="w-5 h-5 text-blue-400" />
            Contact & Location
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Office phone</label>
              <input 
                type="text" 
                value={formData.contactPhone}
                onChange={e => setFormData({...formData, contactPhone: e.target.value})}
                className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="text" 
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-primary/50 outline-none transition"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Social Links */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel p-6 rounded-2xl border border-white/5"
        >
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Instagram className="w-5 h-5 text-pink-500" />
            Social Media Links
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="relative">
                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pink-500" />
                <input 
                  type="url" 
                  placeholder="Instagram Profile URL"
                  value={formData.instagram}
                  onChange={e => setFormData({...formData, instagram: e.target.value})}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-primary/50 outline-none transition"
                />
              </div>
              <div className="relative">
                <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                <input 
                  type="url" 
                  placeholder="LinkedIn Page URL"
                  value={formData.linkedin}
                  onChange={e => setFormData({...formData, linkedin: e.target.value})}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-primary/50 outline-none transition"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600" />
                <input 
                  type="url" 
                  placeholder="Facebook Page URL"
                  value={formData.facebook}
                  onChange={e => setFormData({...formData, facebook: e.target.value})}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-primary/50 outline-none transition"
                />
              </div>
              <div className="relative">
                <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-400" />
                <input 
                  type="url" 
                  placeholder="Twitter / X Profile URL"
                  value={formData.twitter}
                  onChange={e => setFormData({...formData, twitter: e.target.value})}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-primary/50 outline-none transition"
                />
              </div>
            </div>
          </div>
        </motion.div>

        <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/10 rounded-xl">
           <div className="flex items-center gap-2 text-primary">
              <Info className="w-5 h-5" />
              <span className="text-sm font-medium">Any changes made here will reflect globally on your website theme.</span>
           </div>
           <button 
            type="submit" 
            disabled={isSaving || isViewer}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-lg font-bold transition shadow-lg shadow-primary/20 disabled:opacity-50"
            title={isViewer ? "Viewers cannot modify settings" : "Save Settings"}
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {isViewer ? "Read-Only Mode" : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
