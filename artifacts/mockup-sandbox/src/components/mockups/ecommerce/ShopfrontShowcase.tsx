import "./_group.css";
import {
  Star,
  ShoppingBag,
  Truck,
  ShieldCheck,
  Leaf,
  RotateCcw,
  Search,
  Menu,
  Plus,
  ArrowRight,
  Check,
  Coffee,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ACCENT = "#c2603a";
const INK = "#211a14";

function Stars({ value = 5, size = 14 }: { value?: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i < Math.round(value) ? "fill-current text-[#c2603a]" : "text-[#d8cdbd]"}
          strokeWidth={i < Math.round(value) ? 0 : 1.5}
        />
      ))}
    </div>
  );
}

const PRODUCTS = [
  { img: "ecom-prod-1.png", name: "Midnight Reserve", note: "Dark Roast · Sumatra", price: 22, rating: 5, reviews: 412, tag: "Bestseller" },
  { img: "ecom-prod-2.png", name: "Sunrise Blend", note: "Light Roast · Ethiopia", price: 20, rating: 5, reviews: 318, tag: null },
  { img: "ecom-prod-3.png", name: "Canyon Gold", note: "Medium Roast · Colombia", price: 21, rating: 4, reviews: 256, tag: null },
  { img: "ecom-prod-4.png", name: "Quiet Hours", note: "Decaf · Honduras", price: 20, rating: 5, reviews: 189, tag: null },
  { img: "ecom-prod-5.png", name: "Deep Current", note: "Espresso · Brazil", price: 23, rating: 5, reviews: 374, tag: "New" },
  { img: "ecom-prod-6.png", name: "Noir Edition", note: "Single Origin · Kenya", price: 26, rating: 5, reviews: 142, tag: "Limited" },
  { img: "ecom-prod-7.png", name: "Cold Brew Concentrate", note: "Ready to Pour · 32oz", price: 18, rating: 4, reviews: 203, tag: null },
  { img: "ecom-prod-8.png", name: "The Morning Kit", note: "Bundle · Bags + Mug", price: 48, rating: 5, reviews: 96, tag: "Gift" },
];

const REVIEWS = [
  {
    avatar: "ecom-avatar-1.png",
    name: "Marielle T.",
    location: "Verified · Portland, OR",
    quote:
      "The Midnight Reserve completely ruined every other coffee for me. Smooth, chocolatey, zero bitterness. My subscription is the best $22 I spend each month.",
  },
  {
    avatar: "ecom-avatar-2.png",
    name: "Devon R.",
    location: "Verified · Austin, TX",
    quote:
      "You can taste that these beans were roasted days — not months — ago. The freshness is unreal and shipping was lightning fast. Genuinely a better cup at home than my local shop.",
  },
  {
    avatar: "ecom-avatar-3.png",
    name: "Priya N.",
    location: "Verified · Brooklyn, NY",
    quote:
      "Gorgeous packaging, ethically sourced, and the Sunrise Blend is bright and fruity without being sour. I've gifted four bags already. Everyone asks where it's from.",
  },
];

export function ShopfrontShowcase() {
  return (
    <div className="meridian-root min-h-screen w-full bg-[#fbf7f0] text-[#211a14] antialiased">
      {/* Announcement bar */}
      <div className="w-full bg-[#211a14] text-[#f6f0e6]">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2.5 text-xs tracking-wide">
          <Truck className="h-3.5 w-3.5" style={{ color: ACCENT }} />
          <span className="font-medium">Free carbon-neutral shipping on orders over $50</span>
          <span className="hidden text-[#f6f0e6]/40 sm:inline">·</span>
          <span className="hidden text-[#f6f0e6]/70 sm:inline">Roasted to order, shipped within 24 hours</span>
        </div>
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-[#211a14]/10 bg-[#fbf7f0]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-8">
            <a href="#" className="flex items-center gap-2">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: ACCENT }}
              >
                <Coffee className="h-5 w-5 text-[#fbf7f0]" />
              </span>
              <span className="font-display text-2xl font-600 tracking-tight" style={{ fontWeight: 600 }}>
                Meridian
              </span>
            </a>
            <nav className="hidden items-center gap-7 text-sm font-medium text-[#211a14]/70 md:flex">
              <a href="#shop" className="transition-colors hover:text-[#211a14]">Shop</a>
              <a href="#collections" className="transition-colors hover:text-[#211a14]">Collections</a>
              <a href="#reviews" className="transition-colors hover:text-[#211a14]">About</a>
              <a href="#" className="transition-colors hover:text-[#211a14]">Subscribe</a>
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button className="hidden h-9 w-9 items-center justify-center rounded-full text-[#211a14]/70 transition-colors hover:bg-[#211a14]/5 sm:flex">
              <Search className="h-5 w-5" />
            </button>
            <button className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#211a14]/70 transition-colors hover:bg-[#211a14]/5">
              <ShoppingBag className="h-5 w-5" />
              <span
                className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: ACCENT }}
              >
                3
              </span>
            </button>
            <Button
              className="ml-1 hidden rounded-full px-5 text-sm font-semibold text-white shadow-sm hover:opacity-90 sm:inline-flex"
              style={{ backgroundColor: ACCENT }}
            >
              Shop coffee
            </Button>
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-[#211a14]/70 md:hidden">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#f6f0e6]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-6 lg:py-20">
          <div className="order-2 lg:order-1">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest"
              style={{ borderColor: `${ACCENT}55`, color: ACCENT }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
              Flagship Roast
            </span>
            <h1 className="font-display mt-5 text-5xl leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.2rem]">
              Midnight
              <br />
              Reserve.
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-[#211a14]/70">
              A slow, small-batch dark roast with notes of dark chocolate, fig, and toasted
              hazelnut. Roasted to order, never sitting on a shelf.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <Stars value={5} size={18} />
              <span className="text-sm font-medium text-[#211a14]/70">4.9 · 412 reviews</span>
            </div>

            {/* Variant selector */}
            <div className="mt-7">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#211a14]/50">
                Grind
              </p>
              <div className="flex flex-wrap gap-2">
                {["Whole Bean", "Espresso", "Pour Over", "French Press"].map((g, i) => (
                  <button
                    key={g}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                      i === 0
                        ? "border-[#211a14] bg-[#211a14] text-[#f6f0e6]"
                        : "border-[#211a14]/20 bg-transparent text-[#211a14]/80 hover:border-[#211a14]/50"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl font-semibold">$22</span>
                <span className="text-sm text-[#211a14]/50 line-through">$26</span>
              </div>
              <Button
                className="h-12 rounded-full px-7 text-base font-semibold text-white shadow-lg shadow-[#c2603a]/30 transition-transform hover:scale-[1.02] hover:opacity-95"
                style={{ backgroundColor: ACCENT }}
              >
                <ShoppingBag className="mr-2 h-5 w-5" />
                Add to cart
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-full border-[#211a14]/25 bg-transparent px-7 text-base font-semibold text-[#211a14] hover:bg-[#211a14] hover:text-[#f6f0e6]"
              >
                Buy now
              </Button>
            </div>

            {/* Trust badges */}
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#211a14]/70">
              <span className="inline-flex items-center gap-2">
                <RotateCcw className="h-4 w-4" style={{ color: ACCENT }} /> Free 30-day returns
              </span>
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" style={{ color: ACCENT }} /> Secure checkout
              </span>
              <span className="inline-flex items-center gap-2">
                <Leaf className="h-4 w-4" style={{ color: ACCENT }} /> Ethically sourced
              </span>
            </div>
          </div>

          <div className="relative order-1 lg:order-2">
            <div className="absolute -right-10 -top-10 h-72 w-72 rounded-full opacity-50 blur-3xl" style={{ backgroundColor: `${ACCENT}33` }} />
            <div className="relative overflow-hidden rounded-[2rem] bg-[#fbf7f0] shadow-2xl shadow-[#211a14]/15 ring-1 ring-[#211a14]/5">
              <img
                src="/__mockup/images/ecom-hero.png"
                alt="Midnight Reserve coffee bag"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-5 left-5 flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-xl ring-1 ring-[#211a14]/5 backdrop-blur sm:left-8">
              <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: `${ACCENT}1a` }}>
                <Coffee className="h-4.5 w-4.5" style={{ color: ACCENT }} />
              </span>
              <div className="leading-tight">
                <p className="text-xs text-[#211a14]/55">Roasted</p>
                <p className="text-sm font-semibold">Within 24 hours</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="border-y border-[#211a14]/10 bg-[#fbf7f0]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px overflow-hidden bg-[#211a14]/10 lg:grid-cols-4">
          {[
            { icon: Leaf, title: "Sustainably sourced", desc: "Direct-trade beans from family farms" },
            { icon: RotateCcw, title: "Free 30-day returns", desc: "Love it or your money back" },
            { icon: Truck, title: "Carbon-neutral shipping", desc: "Offset on every single order" },
            { icon: Coffee, title: "Roasted to order", desc: "Never older than a few days" },
          ].map((v) => (
            <div key={v.title} className="flex flex-col items-start gap-3 bg-[#fbf7f0] px-6 py-8 sm:items-center sm:text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: `${ACCENT}14` }}>
                <v.icon className="h-5 w-5" style={{ color: ACCENT }} />
              </span>
              <div>
                <p className="font-semibold">{v.title}</p>
                <p className="mt-1 text-sm text-[#211a14]/60">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Collection banners */}
      <section id="collections" className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-3xl bg-[#211a14] p-8 text-[#f6f0e6] sm:p-10">
            <div className="relative z-10 max-w-xs">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>The Roaster's Picks</p>
              <h3 className="font-display mt-3 text-3xl leading-tight">Single-origin spotlight</h3>
              <p className="mt-3 text-sm text-[#f6f0e6]/70">Rare micro-lots, rotated monthly. Bright, complex, and never repeated.</p>
              <button className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#f6f0e6]">
                Explore collection <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <img src="/__mockup/images/ecom-prod-6.png" alt="" className="absolute -right-6 bottom-0 h-44 w-44 rounded-2xl object-cover opacity-90 sm:h-56 sm:w-56" />
          </div>
          <div className="relative overflow-hidden rounded-3xl p-8 sm:p-10" style={{ backgroundColor: ACCENT }}>
            <div className="relative z-10 max-w-xs text-white">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/80">Subscribe & save 15%</p>
              <h3 className="font-display mt-3 text-3xl leading-tight">Coffee on your schedule</h3>
              <p className="mt-3 text-sm text-white/85">Fresh bags delivered every 1, 2, or 4 weeks. Pause or cancel anytime.</p>
              <button className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold" style={{ color: ACCENT }}>
                Start a plan <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <img src="/__mockup/images/ecom-lifestyle.png" alt="" className="absolute -right-4 bottom-0 h-44 w-52 rounded-2xl object-cover opacity-90 sm:h-56 sm:w-64" />
          </div>
        </div>
      </section>

      {/* Product grid */}
      <section id="shop" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>Shop the catalog</p>
            <h2 className="font-display mt-2 text-4xl tracking-tight">Featured roasts</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {["All", "Dark", "Medium", "Light", "Decaf", "Bundles"].map((c, i) => (
              <button
                key={c}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  i === 0 ? "bg-[#211a14] text-[#f6f0e6]" : "bg-[#211a14]/5 text-[#211a14]/70 hover:bg-[#211a14]/10"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-9 grid grid-cols-2 gap-5 sm:gap-6 lg:grid-cols-4">
          {PRODUCTS.map((p) => (
            <div key={p.name} className="meridian-card-hover group rounded-2xl bg-white p-3 ring-1 ring-[#211a14]/5">
              <div className="relative overflow-hidden rounded-xl bg-[#f6f0e6]">
                <img src={`/__mockup/images/${p.img}`} alt={p.name} className="aspect-square w-full object-cover" />
                {p.tag && (
                  <span
                    className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: p.tag === "Bestseller" || p.tag === "Limited" ? INK : ACCENT }}
                  >
                    {p.tag}
                  </span>
                )}
                <button className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#211a14]/60 shadow-sm backdrop-blur transition-colors hover:text-[#c2603a]">
                  <Heart className="h-4 w-4" />
                </button>
                <div className="meridian-quick-add absolute inset-x-3 bottom-3">
                  <button
                    className="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-white shadow-lg"
                    style={{ backgroundColor: ACCENT }}
                  >
                    <Plus className="h-4 w-4" /> Add to cart
                  </button>
                </div>
              </div>
              <div className="px-1 pb-1 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-base font-600 leading-tight" style={{ fontWeight: 600 }}>{p.name}</h3>
                  <span className="font-semibold">${p.price}</span>
                </div>
                <p className="mt-0.5 text-xs text-[#211a14]/55">{p.note}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <Stars value={p.rating} size={12} />
                  <span className="text-xs text-[#211a14]/50">({p.reviews})</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Press / logo strip */}
      <section className="overflow-hidden border-y border-[#211a14]/10 bg-[#f6f0e6] py-6">
        <div className="flex w-max meridian-marquee gap-16 px-8 text-lg font-semibold uppercase tracking-widest text-[#211a14]/35">
          {[...Array(2)].map((_, dup) => (
            <div key={dup} className="flex shrink-0 gap-16">
              <span>The Roast Times</span>
              <span>·</span>
              <span>Brew Monthly</span>
              <span>·</span>
              <span>Daily Grind</span>
              <span>·</span>
              <span>Origin Journal</span>
              <span>·</span>
              <span>Café Culture</span>
              <span>·</span>
            </div>
          ))}
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-3">
            <Stars value={5} size={22} />
            <span className="font-display text-3xl font-semibold">4.9</span>
          </div>
          <p className="text-sm text-[#211a14]/60">
            Rated <span className="font-semibold text-[#211a14]">excellent</span> by 11,400+ verified coffee drinkers
          </p>
          <h2 className="font-display mt-2 text-4xl tracking-tight">Loved cup after cup</h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {REVIEWS.map((r) => (
            <div key={r.name} className="flex flex-col rounded-2xl bg-white p-6 ring-1 ring-[#211a14]/5">
              <Stars value={5} size={15} />
              <p className="mt-4 flex-1 text-[15px] leading-relaxed text-[#211a14]/80">“{r.quote}”</p>
              <div className="mt-5 flex items-center gap-3 border-t border-[#211a14]/10 pt-4">
                <img src={`/__mockup/images/${r.avatar}`} alt={r.name} className="h-10 w-10 rounded-full object-cover" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{r.name}</p>
                  <p className="text-xs text-[#211a14]/50">{r.location}</p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium" style={{ color: ACCENT }}>
                  <Check className="h-3.5 w-3.5" /> Verified
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA / bundle */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="overflow-hidden rounded-[2.5rem] bg-[#211a14] text-[#f6f0e6]">
          <div className="grid items-center gap-10 p-8 sm:p-12 lg:grid-cols-2 lg:p-16">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white" style={{ backgroundColor: ACCENT }}>
                Best value
              </span>
              <h2 className="font-display mt-5 text-4xl leading-tight tracking-tight sm:text-5xl">
                The Morning Kit
              </h2>
              <p className="mt-4 max-w-md text-[#f6f0e6]/70">
                Two of our most-loved roasts plus a handmade stoneware mug. Everything you need
                for a better morning ritual — bundled and discounted.
              </p>
              <div className="mt-7 flex items-center gap-4">
                <span className="font-display text-4xl font-semibold">$48</span>
                <span className="text-lg text-[#f6f0e6]/40 line-through">$64</span>
                <span className="rounded-full bg-[#f6f0e6]/10 px-3 py-1 text-xs font-semibold">Save 25%</span>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  className="h-12 rounded-full px-8 text-base font-semibold text-white shadow-lg shadow-[#c2603a]/30 hover:opacity-95"
                  style={{ backgroundColor: ACCENT }}
                >
                  <ShoppingBag className="mr-2 h-5 w-5" /> Add bundle to cart
                </Button>
              </div>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#f6f0e6]/70">
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" style={{ color: ACCENT }} /> 100% satisfaction guarantee</span>
                <span className="inline-flex items-center gap-2"><RotateCcw className="h-4 w-4" style={{ color: ACCENT }} /> Free returns</span>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl opacity-30 blur-3xl" style={{ backgroundColor: ACCENT }} />
              <img
                src="/__mockup/images/ecom-prod-8.png"
                alt="The Morning Kit bundle"
                className="relative w-full rounded-3xl object-cover shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#211a14]/10 bg-[#f6f0e6]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <a href="#" className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: ACCENT }}>
                  <Coffee className="h-5 w-5 text-[#fbf7f0]" />
                </span>
                <span className="font-display text-2xl" style={{ fontWeight: 600 }}>Meridian</span>
              </a>
              <p className="mt-4 max-w-xs text-sm text-[#211a14]/60">
                Small-batch coffee, roasted to order and shipped within 24 hours. Better mornings,
                one cup at a time.
              </p>
              <div className="mt-6">
                <p className="text-sm font-semibold">Join the club</p>
                <p className="mt-1 text-sm text-[#211a14]/55">Get 10% off your first order + brewing tips.</p>
                <div className="mt-3 flex max-w-sm gap-2">
                  <Input
                    placeholder="you@email.com"
                    className="h-11 rounded-full border-[#211a14]/15 bg-white px-4"
                  />
                  <Button
                    className="h-11 shrink-0 rounded-full px-6 font-semibold text-white hover:opacity-90"
                    style={{ backgroundColor: ACCENT }}
                  >
                    Subscribe
                  </Button>
                </div>
              </div>
            </div>

            {[
              { h: "Shop", links: ["Dark roasts", "Light roasts", "Decaf", "Bundles", "Gift cards"] },
              { h: "Company", links: ["Our story", "Sourcing", "Sustainability", "Careers"] },
              { h: "Support", links: ["Contact", "Shipping", "Returns", "Brew guides", "FAQ"] },
            ].map((col) => (
              <div key={col.h}>
                <p className="text-sm font-semibold uppercase tracking-wide text-[#211a14]/80">{col.h}</p>
                <ul className="mt-4 space-y-2.5 text-sm text-[#211a14]/60">
                  {col.links.map((l) => (
                    <li key={l}><a href="#" className="transition-colors hover:text-[#211a14]">{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[#211a14]/10 pt-6 sm:flex-row">
            <p className="text-xs text-[#211a14]/50">© 2025 Meridian Coffee Co. All rights reserved.</p>
            <div className="flex items-center gap-2">
              {["VISA", "MC", "AMEX", "PAY", "GPay"].map((p) => (
                <span
                  key={p}
                  className="flex h-7 items-center justify-center rounded-md bg-white px-2.5 text-[10px] font-bold tracking-wide text-[#211a14]/55 ring-1 ring-[#211a14]/10"
                >
                  {p}
                </span>
              ))}
            </div>
            <div className="flex gap-5 text-xs text-[#211a14]/50">
              <a href="#" className="hover:text-[#211a14]">Privacy</a>
              <a href="#" className="hover:text-[#211a14]">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
