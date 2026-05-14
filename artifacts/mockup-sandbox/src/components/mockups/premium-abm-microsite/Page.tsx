import React, { useState } from "react";
import { motion } from "framer-motion";

const SLATE = "#0F172A";
const PAPER = "#FFFFFF";
const BLUE = "#3B82F6";
const VIOLET = "hsl(258, 70%, 54%)";
const BORDER = "#E2E8F0";
const TEXT_MUTED = "#64748B";

function Nav() {
  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "24px 48px",
        borderBottom: `1px solid ${BORDER}`,
        background: PAPER,
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em", color: SLATE }}>
          Dandy
        </div>
        <div style={{ width: 1, height: 24, background: BORDER }} />
        <div style={{ fontWeight: 600, fontSize: 18, color: SLATE }}>Acme Dental Group</div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: TEXT_MUTED }}>
        Prepared by Sarah Jenkins · Enterprise AE
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        minHeight: "calc(100vh - 80px)",
        background: PAPER,
      }}
    >
      <div
        style={{
          padding: "80px 48px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          borderRight: `1px solid ${BORDER}`,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 16,
            border: `1px solid ${BORDER}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            fontWeight: 700,
            color: BLUE,
            marginBottom: 40,
            background: "#F8FAFC",
          }}
        >
          A
        </div>
        <h1
          style={{
            fontSize: 64,
            fontWeight: 600,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            color: SLATE,
            marginBottom: 24,
            maxWidth: 600,
          }}
        >
          A proposal for <br />
          Acme Dental Group.
        </h1>
        <p
          style={{
            fontSize: 20,
            lineHeight: 1.6,
            color: TEXT_MUTED,
            maxWidth: 540,
            marginBottom: 48,
          }}
        >
          We know you're looking to standardize digital workflows across your 14 locations. This microsite outlines exactly how Dandy can help you get there by Q4, based on our conversations over the past month.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img
            src="https://ui-avatars.com/api/?name=Sarah+Jenkins&background=random"
            alt="Sarah"
            style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${PAPER}` }}
          />
          <div>
            <div style={{ fontWeight: 600, color: SLATE }}>Sarah Jenkins</div>
            <div style={{ fontSize: 14, color: TEXT_MUTED }}>Enterprise Account Executive, Dandy</div>
          </div>
        </div>
      </div>
      <div style={{ background: "#F1F5F9", position: "relative" }}>
        {/* Placeholder for video */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              background: PAPER,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderTop: "10px solid transparent",
                borderBottom: "10px solid transparent",
                borderLeft: `16px solid ${BLUE}`,
                marginLeft: 6,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ROI() {
  const stats = [
    { label: "Projected Annual Savings", value: "$420k" },
    { label: "Reduction in Remakes", value: "65%" },
    { label: "Time Saved Per Doctor / Wk", value: "4.5 hrs" },
  ];

  return (
    <section style={{ padding: "120px 48px", borderBottom: `1px solid ${BORDER}`, background: PAPER }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h2 style={{ fontSize: 32, fontWeight: 600, color: SLATE, marginBottom: 64, letterSpacing: "-0.02em" }}>
          The Acme ROI Model
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ padding: 40, border: `1px solid ${BORDER}`, borderRadius: 16 }}>
              <div style={{ fontSize: 48, fontWeight: 700, color: BLUE, marginBottom: 16, letterSpacing: "-0.02em" }}>
                {s.value}
              </div>
              <div style={{ fontSize: 16, fontWeight: 500, color: TEXT_MUTED }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PainPoints() {
  const points = [
    {
      title: "Fragmented Lab Network",
      desc: "Currently managing 8+ different labs across 14 locations, leading to inconsistent quality and complex invoicing.",
    },
    {
      title: "Analog Inefficiency",
      desc: "70% of locations still using PVS impressions. Staff spending too much time on material prep and cleanup.",
    },
    {
      title: "Lack of Oversight",
      desc: "No centralized dashboard to track lab spend, case turnaround times, or remake rates across the group.",
    },
  ];

  return (
    <section style={{ padding: "120px 48px", borderBottom: `1px solid ${BORDER}`, background: PAPER }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h2 style={{ fontSize: 32, fontWeight: 600, color: SLATE, marginBottom: 64, letterSpacing: "-0.02em" }}>
          Why Dandy fits Acme
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {points.map((p, i) => (
            <div key={i} style={{ padding: 40, border: `1px solid ${BORDER}`, borderRadius: 16, background: "#F8FAFC" }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: PAPER, border: `1px solid ${BORDER}`, marginBottom: 24 }} />
              <div style={{ fontSize: 20, fontWeight: 600, color: SLATE, marginBottom: 16 }}>{p.title}</div>
              <div style={{ fontSize: 16, lineHeight: 1.6, color: TEXT_MUTED }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MAP() {
  const steps = [
    { date: "Oct 15", title: "Kickoff Call", status: "done" },
    { date: "Oct 22", title: "Scanner Delivery & Setup", status: "current" },
    { date: "Oct 25", title: "Staff Training (Virtual)", status: "pending" },
    { date: "Nov 01", title: "First Case Submitted", status: "pending" },
    { date: "Nov 15", title: "Pilot Review & Expansion", status: "pending" },
  ];

  return (
    <section style={{ padding: "120px 48px", borderBottom: `1px solid ${BORDER}`, background: PAPER }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <h2 style={{ fontSize: 32, fontWeight: 600, color: SLATE, marginBottom: 64, letterSpacing: "-0.02em" }}>
          Mutual Action Plan
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 32, opacity: s.status === "pending" ? 0.5 : 1 }}>
              <div style={{ width: 80, fontSize: 16, fontWeight: 500, color: TEXT_MUTED, paddingTop: 4 }}>
                {s.date}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    background: s.status === "done" ? BLUE : PAPER,
                    border: `2px solid ${s.status === "done" ? BLUE : BORDER}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {s.status === "done" && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {s.status === "current" && (
                    <div style={{ width: 10, height: 10, borderRadius: 5, background: BLUE }} />
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div style={{ width: 2, height: 48, background: BORDER }} />
                )}
              </div>
              <div style={{ fontSize: 20, fontWeight: 500, color: SLATE, paddingTop: 1 }}>{s.title}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Scheduler() {
  return (
    <section style={{ padding: "120px 48px", background: PAPER }}>
      <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 32, fontWeight: 600, color: SLATE, marginBottom: 24, letterSpacing: "-0.02em" }}>
          Ready to make this real?
        </h2>
        <p style={{ fontSize: 18, color: TEXT_MUTED, marginBottom: 48 }}>
          Grab 15 minutes to review this proposal and confirm next steps.
        </p>
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 16, padding: 64, background: "#F8FAFC" }}>
          <div style={{ width: "100%", height: 400, background: PAPER, border: `1px solid ${BORDER}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: TEXT_MUTED }}>
            [Calendly Embed Placeholder]
          </div>
        </div>
        <button
          style={{
            marginTop: 48,
            background: VIOLET,
            color: PAPER,
            border: "none",
            padding: "16px 32px",
            fontSize: 18,
            fontWeight: 600,
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Sign Proposal
        </button>
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: PAPER }}>
      <Nav />
      <Hero />
      <ROI />
      <PainPoints />
      <MAP />
      <Scheduler />
    </div>
  );
}
