import { SettingsClient } from "@/components/settings/settings-client";

export default function SettingsPage() {
  return <SettingsClient hasGeminiKey={!!process.env.GEMINI_API_KEY} />;
}
