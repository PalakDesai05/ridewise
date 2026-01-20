import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const SUBJECT_OPTIONS = [
  "General Query",
  "Reservation Issue",
  "Payment Issue",
  "Technical Issue",
  "Feedback",
];

function isValidEmail(email: string) {
  return /\S+@\S+\.\S+/.test(email);
}

export default function ContactPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(SUBJECT_OPTIONS[0]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-fill email and name when user is logged in
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
    if (user?.name) {
      setName(user.name);
    }
  }, [user]);

  const validate = () => {
    if (!name.trim()) return "Please enter your name.";
    if (!email.trim()) return "Please enter your email.";
    if (!isValidEmail(email)) return "Please enter a valid email address.";
    if (!subject) return "Please select a subject.";
    if (!message.trim() || message.trim().length < 10) return "Message must be at least 10 characters.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast({ title: "Validation Error", description: err });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:5000/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });

      if (res.ok) {
        setName("");
        setEmail("");
        setSubject(SUBJECT_OPTIONS[0]);
        setMessage("");
        toast({ title: "Success", description: "Your query has been sent successfully. We’ll get back to you soon." });
      } else {
        const body = await res.json().catch(() => ({}));
        const msg = body && body.error ? body.error : "Failed to send your query. Please try again later.";
        toast({ title: "Error", description: msg });
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to send your query. Please try again later." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold">Contact RideWise</h1>
        <p className="mt-2 text-sm text-muted-foreground">Facing an issue or have a question? Reach out to us.</p>

        <div className="mt-4 bg-card p-6 rounded-lg">
          <p className="mb-4">
            Official Contact Email: <a className="text-primary underline" href="mailto:ridewisebike@gmail.com">ridewisebike@gmail.com</a>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Input value={name} onChange={(e) => setName((e.target as HTMLInputElement).value)} placeholder="Your name" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail((e.target as HTMLInputElement).value)} placeholder="you@example.com" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm"
              >
                {SUBJECT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <Textarea value={message} onChange={(e) => setMessage((e.target as HTMLTextAreaElement).value)} placeholder="Your message..." />
            </div>

            <div>
              <Button type="submit" disabled={loading}>{loading ? "Sending..." : "Send Query"}</Button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
