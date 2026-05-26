"use client";

import { useState, useRef } from "react";

type FormStatus = "idle" | "submitting" | "success" | "error";

const SUBJECTS = [
  "Story tip",
  "Correction",
  "Press enquiry",
  "Advertising",
  "Technical issue",
  "Privacy request",
  "Other",
];

export default function ContactForm() {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const form = e.currentTarget;
    const data = new FormData(form);

    const payload = {
      name:    (data.get("name")    as string).trim(),
      email:   (data.get("email")   as string).trim(),
      subject: (data.get("subject") as string).trim(),
      message: (data.get("message") as string).trim(),
      website: (data.get("website") as string).trim(), // honeypot
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setStatus("success");
        formRef.current?.reset();
      } else {
        const json = await res.json().catch(() => ({}));
        setErrorMessage(
          (json as { error?: string }).error ?? "Something went wrong. Please try again."
        );
        setStatus("error");
      }
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="border-l-4 border-gold-500 bg-cream-200 dark:bg-navy-400 p-6">
        <p className="font-headline font-bold text-navy-500 dark:text-cream-100 text-xl mb-2">
          Message sent.
        </p>
        <p className="font-body text-base text-ink-muted dark:text-cream-300">
          We aim to respond within 2 business days.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="
            mt-4 font-body text-xs font-semibold tracking-widest uppercase
            text-ink-muted dark:text-cream-400 hover:text-red-500
            dark:hover:text-red-400 transition-colors duration-[120ms]
          "
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Honeypot — hidden from humans, visible to bots */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        aria-hidden="true"
        autoComplete="off"
        className="absolute left-[-9999px] opacity-0 pointer-events-none"
      />

      {/* Name */}
      <div>
        <label
          htmlFor="contact-name"
          className="font-body text-xs font-semibold tracking-widest uppercase text-ink-faint dark:text-cream-400 mb-1.5 block"
        >
          Name *
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          autoComplete="name"
          className="
            w-full px-3 py-2.5
            bg-cream-50 dark:bg-navy-400
            border border-rule dark:border-rule-dark
            text-ink dark:text-cream-100 placeholder:text-ink-faint dark:placeholder:text-cream-500
            font-body text-base
            focus:outline-none focus:border-navy-500 dark:focus:border-cream-200
            transition-colors duration-[120ms] rounded-none
          "
          placeholder="Your name"
        />
      </div>

      {/* Email */}
      <div>
        <label
          htmlFor="contact-email"
          className="font-body text-xs font-semibold tracking-widest uppercase text-ink-faint dark:text-cream-400 mb-1.5 block"
        >
          Email *
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="
            w-full px-3 py-2.5
            bg-cream-50 dark:bg-navy-400
            border border-rule dark:border-rule-dark
            text-ink dark:text-cream-100 placeholder:text-ink-faint dark:placeholder:text-cream-500
            font-body text-base
            focus:outline-none focus:border-navy-500 dark:focus:border-cream-200
            transition-colors duration-[120ms] rounded-none
          "
          placeholder="your@email.com"
        />
      </div>

      {/* Subject */}
      <div>
        <label
          htmlFor="contact-subject"
          className="font-body text-xs font-semibold tracking-widest uppercase text-ink-faint dark:text-cream-400 mb-1.5 block"
        >
          Subject *
        </label>
        <select
          id="contact-subject"
          name="subject"
          required
          defaultValue=""
          className="
            w-full px-3 py-2.5
            bg-cream-50 dark:bg-navy-400
            border border-rule dark:border-rule-dark
            text-ink dark:text-cream-100
            font-body text-base
            focus:outline-none focus:border-navy-500 dark:focus:border-cream-200
            transition-colors duration-[120ms] rounded-none
            cursor-pointer
          "
        >
          <option value="" disabled>Select a subject</option>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Message */}
      <div>
        <label
          htmlFor="contact-message"
          className="font-body text-xs font-semibold tracking-widest uppercase text-ink-faint dark:text-cream-400 mb-1.5 block"
        >
          Message *
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={20}
          rows={6}
          className="
            w-full px-3 py-2.5
            bg-cream-50 dark:bg-navy-400
            border border-rule dark:border-rule-dark
            text-ink dark:text-cream-100 placeholder:text-ink-faint dark:placeholder:text-cream-500
            font-body text-base
            focus:outline-none focus:border-navy-500 dark:focus:border-cream-200
            transition-colors duration-[120ms] rounded-none
            resize-y min-h-[140px]
          "
          placeholder="Tell us what's on your mind (minimum 20 characters)"
        />
      </div>

      {/* Error */}
      {status === "error" && (
        <div className="border-l-4 border-red-500 bg-red-50 dark:bg-navy-400 p-4">
          <p className="font-body text-sm text-red-600 dark:text-red-400">
            {errorMessage}
          </p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="
          w-full px-4 py-3 cursor-pointer
          bg-navy-500 hover:bg-red-500
          disabled:opacity-60 disabled:cursor-not-allowed
          font-body text-xs font-bold tracking-widest uppercase
          text-cream-100
          transition-colors duration-[120ms]
          border-0
        "
      >
        {status === "submitting" ? "Sending…" : "Send message"}
      </button>

      <p className="font-data text-[11px] text-ink-faint dark:text-cream-500 tracking-wide">
        We aim to respond within 2 business days.
      </p>
    </form>
  );
}
