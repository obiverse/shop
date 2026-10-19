//! The shop's ledger. Every number that touches money or dates passes through here.
//! Money is integer minor units (kobo, cents). Dates are "YYYY-MM-DD", counted inclusively.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// ── shapes ────────────────────────────────────────────────────────────────

/// A booking. `qty` absent means the whole stock (the item is simply unavailable).
#[derive(Deserialize, Clone)]
pub struct Range { pub from: String, pub to: String, #[serde(default)] pub qty: Option<u32> }

/// Rental terms. `units` is how many exist (e.g. 300 chairs); absent means one.
#[derive(Deserialize, Clone)]
pub struct Rent {
    pub deposit: u64,
    pub min_days: u32,
    #[serde(default)] pub units: Option<u32>,
    #[serde(default)] pub booked: Vec<Range>,
}

#[derive(Deserialize, Clone)]
pub struct Product {
    pub id: String,
    pub title: String,
    pub house: String,
    pub mode: String, // "buy" | "rent"
    pub price: u64,   // buy: per item · rent: per day
    #[serde(default)] pub stock: String,
    #[serde(default)] pub rent: Option<Rent>,
    #[serde(default)] pub sale: Option<Sale>,
}

/// A real, time-boxed offer. After `ends` (inclusive) the regular price applies again.
#[derive(Deserialize, Clone)]
pub struct Sale { pub price: u64, #[serde(default)] pub ends: String }

#[derive(Deserialize, Clone)]
pub struct House { pub id: String, pub name: String, pub currency: String }

#[derive(Deserialize)]
pub struct Catalog {
    pub products: Vec<Product>,
    pub houses: Vec<House>,
    /// "YYYY-MM-DD" in the shopper's time zone; empty = treat every offer as running.
    #[serde(default)] pub today: String,
}

#[derive(Deserialize, Serialize, Clone, Default)]
pub struct Item {
    pub id: String,
    pub qty: u32,
    #[serde(default)] pub opt: String,
    #[serde(default)] pub from: String,
    #[serde(default)] pub to: String,
}

#[derive(Serialize, Default)]
pub struct Line {
    pub id: String, pub title: String, pub house: String, pub mode: String,
    pub qty: u32, pub opt: String, pub from: String, pub to: String,
    pub days: u32, pub unit: u64, pub was: u64, pub deposit: u64, pub total: u64, pub saved: u64,
    pub error: Option<String>,
}

#[derive(Serialize)]
pub struct HouseTotal {
    pub house: String, pub name: String, pub currency: String,
    pub items: u32, pub subtotal: u64, pub deposits: u64, pub total: u64, pub saved: u64, pub code: String,
}

#[derive(Serialize)]
pub struct Quote { pub lines: Vec<Line>, pub houses: Vec<HouseTotal>, pub ok: bool }

#[derive(Serialize, Debug, PartialEq)]
pub struct DateCheck { pub ok: bool, pub days: u32, pub free: u32, pub error: Option<String> }

// ── dates ─────────────────────────────────────────────────────────────────

/// Days since 1970-01-01 (Hinnant's days_from_civil). None if malformed.
pub fn day_number(s: &str) -> Option<i64> {
    let p: Vec<&str> = s.split('-').collect();
    if p.len() != 3 { return None; }
    let (y, m, d): (i64, i64, i64) = (p[0].parse().ok()?, p[1].parse().ok()?, p[2].parse().ok()?);
    let dim = [31, if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if !(1..=12).contains(&m) || d < 1 || d > dim[(m - 1) as usize] { return None; }
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    Some(era * 146097 + doe - 719468)
}

/// Are `qty` units free on every day from..=to? `free` is the fewest units free on any of those days.
pub fn check(from: &str, to: &str, qty: u32, r: &Rent) -> DateCheck {
    let units = r.units.unwrap_or(1).max(1);
    let bad = |days: u32, free: u32, e: String| DateCheck { ok: false, days, free, error: Some(e) };
    let (Some(a), Some(b)) = (day_number(from), day_number(to)) else { return bad(0, 0, "Choose a start and end date".into()) };
    if b < a { return bad(0, 0, "End date is before start date".into()) }
    let days = (b - a + 1) as u32;
    let spans: Vec<(i64, i64, u32)> = r.booked.iter()
        .filter_map(|x| Some((day_number(&x.from)?, day_number(&x.to)?, x.qty.unwrap_or(units))))
        .filter(|&(x, y, _)| a <= y && b >= x)
        .collect();
    let free = (a..=b).map(|d| units.saturating_sub(spans.iter().filter(|s| s.0 <= d && d <= s.1).map(|s| s.2).sum())).min().unwrap_or(units);
    if days < r.min_days.max(1) { return bad(days, free, format!("Minimum rental is {} days", r.min_days)) }
    if free == 0 { return bad(days, 0, "Fully booked on some of those days".into()) }
    if qty > free { return bad(days, free, format!("Only {} available for those dates", free)) }
    DateCheck { ok: true, days, free, error: None }
}

// ── pricing ───────────────────────────────────────────────────────────────

/// (price now, regular price if an offer is running else 0).
pub fn unit_price(p: &Product, today: &str) -> (u64, u64) {
    match &p.sale {
        Some(s) if s.price < p.price && (s.ends.is_empty() || today.is_empty() || today <= s.ends.as_str()) => (s.price, p.price),
        _ => (p.price, 0),
    }
}

/// `percent` off, rounded down to a multiple of `step` (e.g. ₦500 = 50_000 kobo) so prices stay tidy.
pub fn percent_off(price: u64, percent: u32, step: u64) -> u64 {
    let raw = price * (100 - percent.min(100) as u64) / 100;
    if step == 0 { raw } else { raw / step * step }
}

pub fn price(cat: &Catalog, cart: &[Item]) -> Quote {
    let mut lines = Vec::new();
    for it in cart {
        let mut l = Line { id: it.id.clone(), qty: it.qty.max(1), opt: it.opt.clone(), from: it.from.clone(), to: it.to.clone(), ..Default::default() };
        let Some(p) = cat.products.iter().find(|p| p.id == it.id) else {
            l.error = Some("No longer in the catalogue".into()); lines.push(l); continue;
        };
        let (unit, was) = unit_price(p, &cat.today);
        l.title = p.title.clone(); l.house = p.house.clone(); l.mode = p.mode.clone(); l.unit = unit; l.was = was;
        if p.stock == "out" { l.error = Some("Sold out".into()); }
        if p.mode == "rent" {
            let r = p.rent.clone().unwrap_or(Rent { deposit: 0, min_days: 1, units: None, booked: vec![] });
            let qty = cart.iter().filter(|o| o.id == it.id && o.from == it.from && o.to == it.to).map(|o| o.qty.max(1)).sum();
            let c = check(&it.from, &it.to, qty, &r);
            l.days = c.days; l.deposit = r.deposit * l.qty as u64;
            if c.ok { l.total = unit * c.days as u64 * l.qty as u64; } else if l.error.is_none() { l.error = c.error; }
            if was > 0 && c.ok { l.saved = (was - unit) * c.days as u64 * l.qty as u64; }
        } else {
            l.total = unit * l.qty as u64;
            if was > 0 { l.saved = (was - unit) * l.qty as u64; }
        }
        lines.push(l);
    }
    let mut houses: Vec<HouseTotal> = Vec::new();
    for h in &cat.houses {
        let mine: Vec<&Line> = lines.iter().filter(|l| l.house == h.id).collect();
        if mine.is_empty() { continue; }
        let items: Vec<Item> = cart.iter().filter(|i| mine.iter().any(|l| l.id == i.id)).cloned().collect();
        let subtotal: u64 = mine.iter().filter(|l| l.error.is_none()).map(|l| l.total).sum();
        let deposits: u64 = mine.iter().filter(|l| l.error.is_none()).map(|l| l.deposit).sum();
        let saved: u64 = mine.iter().filter(|l| l.error.is_none()).map(|l| l.saved).sum();
        houses.push(HouseTotal {
            house: h.id.clone(), name: h.name.clone(), currency: h.currency.clone(),
            items: mine.iter().filter(|l| l.error.is_none()).map(|l| l.qty).sum(),
            subtotal, deposits, total: subtotal + deposits, saved, code: code(&items),
        });
    }
    let ok = lines.iter().all(|l| l.error.is_none());
    Quote { lines, houses, ok }
}

/// "₦12,500" · "$19.99" — minor units in, display string out. Whole amounts drop the decimals.
pub fn money(minor: u64, currency: &str) -> String {
    let sym = match currency { "NGN" => "₦", "USD" => "$", "GBP" => "£", "EUR" => "€", "GHS" => "GH₵", "KES" => "KSh ", c => c };
    let (whole, frac) = (minor / 100, minor % 100);
    let digits = whole.to_string();
    let mut out = String::new();
    for (i, ch) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 { out.push(','); }
        out.push(ch);
    }
    if frac == 0 { format!("{sym}{out}") } else { format!("{sym}{out}.{frac:02}") }
}

// ── codes & links ─────────────────────────────────────────────────────────

const B32: &[u8] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford

fn canon(cart: &[Item]) -> String {
    let mut parts: Vec<String> = cart.iter().map(|i| format!("{}*{}*{}*{}*{}", i.id, i.qty.max(1), i.opt, i.from, i.to)).collect();
    parts.sort();
    parts.join("|")
}

/// Stable short code for a cart: OBV-XXXX-C, C a mod-32 check character.
pub fn code(cart: &[Item]) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in canon(cart).bytes() { h ^= b as u64; h = h.wrapping_mul(0x100000001b3); }
    let body: String = (0..4).map(|i| B32[((h >> (i * 5)) & 31) as usize] as char).collect();
    let sum: usize = body.bytes().enumerate().map(|(i, c)| (i + 1) * B32.iter().position(|&x| x == c).unwrap()).sum();
    format!("OBV-{}-{}", body, B32[sum % 32] as char)
}

pub fn valid_code(c: &str) -> bool {
    let p: Vec<&str> = c.split('-').collect();
    if p.len() != 3 || p[0] != "OBV" || p[1].len() != 4 || p[2].len() != 1 { return false; }
    let Some(sum) = p[1].bytes().enumerate().map(|(i, c)| B32.iter().position(|&x| x == c).map(|v| (i + 1) * v)).sum::<Option<usize>>() else { return false };
    B32[sum % 32] == p[2].as_bytes()[0]
}

const B64: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

pub fn encode(cart: &[Item]) -> String {
    let raw = cart.iter().map(|i| format!("{}*{}*{}*{}*{}", i.id, i.qty.max(1), i.opt.replace(['*', '|'], " "), i.from, i.to)).collect::<Vec<_>>().join("|");
    let b = raw.as_bytes();
    let mut out = String::new();
    for ch in b.chunks(3) {
        let n = (ch[0] as u32) << 16 | (*ch.get(1).unwrap_or(&0) as u32) << 8 | *ch.get(2).unwrap_or(&0) as u32;
        for k in 0..=ch.len() { out.push(B64[(n >> (18 - 6 * k) & 63) as usize] as char); }
    }
    out
}

pub fn decode(s: &str) -> Vec<Item> {
    let mut bytes = Vec::new();
    let vals: Vec<u32> = s.bytes().filter_map(|c| B64.iter().position(|&x| x == c).map(|v| v as u32)).collect();
    for ch in vals.chunks(4) {
        let n = ch.iter().enumerate().fold(0u32, |n, (k, v)| n | v << (18 - 6 * k));
        for k in 0..ch.len().saturating_sub(1) { bytes.push((n >> (16 - 8 * k) & 255) as u8); }
    }
    String::from_utf8_lossy(&bytes).split('|').filter(|s| !s.is_empty()).filter_map(|l| {
        let f: Vec<&str> = l.split('*').collect();
        (f.len() == 5).then(|| Item { id: f[0].into(), qty: f[1].parse().unwrap_or(1), opt: f[2].into(), from: f[3].into(), to: f[4].into() })
    }).collect()
}

/// The WhatsApp text for one house's share of the quote.
pub fn compose(q: &Quote, house: &str, verify_base: &str, name: &str, note: &str) -> String {
    let Some(h) = q.houses.iter().find(|h| h.house == house) else { return String::new() };
    let cur = h.currency.as_str();
    let mut t = format!("Hello {}! I'd like to order:\n\n", h.name);
    let mut items = Vec::new();
    for l in q.lines.iter().filter(|l| l.house == house && l.error.is_none()) {
        let opt = if l.opt.is_empty() { String::new() } else { format!(" ({})", l.opt) };
        if l.mode == "rent" {
            t += &format!("• {} × {}{} — RENT {} → {} ({} days) = {}\n", l.qty, l.title, opt, l.from, l.to, l.days, money(l.total, cur));
            if l.deposit > 0 { t += &format!("   refundable deposit {}\n", money(l.deposit, cur)); }
        } else {
            let save = if l.saved > 0 { format!(" (save {})", money(l.saved, cur)) } else { String::new() };
            t += &format!("• {} × {}{} = {}{}\n", l.qty, l.title, opt, money(l.total, cur), save);
        }
        items.push(Item { id: l.id.clone(), qty: l.qty, opt: l.opt.clone(), from: l.from.clone(), to: l.to.clone() });
    }
    t += &format!("\nSubtotal: {}\n", money(h.subtotal, cur));
    if h.deposits > 0 { t += &format!("Deposits: {}\n", money(h.deposits, cur)); }
    if h.saved > 0 { t += &format!("You save: {}\n", money(h.saved, cur)); }
    t += &format!("Total: {}\n\nOrder {}\n", money(h.total, cur), h.code);
    if !name.trim().is_empty() { t += &format!("Name: {}\n", name.trim()); }
    if !note.trim().is_empty() { t += &format!("Note: {}\n", note.trim()); }
    t += &format!("Verify: {}#{}", verify_base, encode(&items));
    t
}

// ── wasm surface ──────────────────────────────────────────────────────────

fn js<T: Serialize>(v: &T) -> Result<JsValue, JsValue> { serde_wasm_bindgen::to_value(v).map_err(|e| e.to_string().into()) }
fn rs<T: for<'de> Deserialize<'de>>(v: JsValue) -> Result<T, JsValue> { serde_wasm_bindgen::from_value(v).map_err(|e| e.to_string().into()) }

#[wasm_bindgen]
pub struct Ledger { cat: Catalog }

#[wasm_bindgen]
impl Ledger {
    #[wasm_bindgen(constructor)]
    pub fn new(catalog: JsValue) -> Result<Ledger, JsValue> { Ok(Ledger { cat: rs(catalog)? }) }

    /// The shopper's date, so offers end on time even if the site hasn't been rebuilt.
    pub fn set_today(&mut self, today: &str) { self.cat.today = today.into(); }

    pub fn quote(&self, cart: JsValue) -> Result<JsValue, JsValue> { js(&price(&self.cat, &rs::<Vec<Item>>(cart)?)) }

    pub fn message(&self, cart: JsValue, house: &str, verify_base: &str, name: &str, note: &str) -> Result<String, JsValue> {
        Ok(compose(&price(&self.cat, &rs::<Vec<Item>>(cart)?), house, verify_base, name, note))
    }

    pub fn dates(&self, id: &str, from: &str, to: &str, qty: u32) -> Result<JsValue, JsValue> {
        let r = self.cat.products.iter().find(|p| p.id == id).and_then(|p| p.rent.clone()).unwrap_or(Rent { deposit: 0, min_days: 1, units: None, booked: vec![] });
        js(&check(from, to, qty.max(1), &r))
    }
}

#[wasm_bindgen] pub fn format_money(minor: f64, currency: &str) -> String { money(minor as u64, currency) }
#[wasm_bindgen] pub fn sale_price(price_minor: f64, percent: u32, step_minor: f64) -> f64 { percent_off(price_minor as u64, percent, step_minor as u64) as f64 }
#[wasm_bindgen] pub fn encode_cart(cart: JsValue) -> Result<String, JsValue> { Ok(encode(&rs::<Vec<Item>>(cart)?)) }
#[wasm_bindgen] pub fn decode_cart(s: &str) -> Result<JsValue, JsValue> { js(&decode(s)) }
#[wasm_bindgen] pub fn check_code(c: &str) -> bool { valid_code(c) }

// ── tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn cat() -> Catalog {
        Catalog {
            houses: vec![House { id: "sandals".into(), name: "Obi Sandals".into(), currency: "NGN".into() },
                         House { id: "scents".into(), name: "Scent House".into(), currency: "NGN".into() }],
            today: String::new(),
            products: vec![
                Product { id: "kano".into(), title: "Kano Slide".into(), house: "sandals".into(), mode: "buy".into(), price: 2_500_000, stock: "in".into(), rent: None, sale: None },
                Product { id: "oud".into(), title: "Oud Noir".into(), house: "scents".into(), mode: "buy".into(), price: 4_000_000, stock: "out".into(), rent: None, sale: None },
                Product { id: "bridal".into(), title: "Bridal Set".into(), house: "sandals".into(), mode: "rent".into(), price: 500_000, stock: "in".into(),
                          rent: Some(Rent { deposit: 2_000_000, min_days: 2, units: None, booked: vec![rg("2026-12-24", "2026-12-26", None)] }), sale: None },
            ],
        }
    }
    fn rg(f: &str, t: &str, q: Option<u32>) -> Range { Range { from: f.into(), to: t.into(), qty: q } }
    fn it(id: &str, qty: u32, from: &str, to: &str) -> Item { Item { id: id.into(), qty, opt: "42".into(), from: from.into(), to: to.into() } }

    #[test] fn days() {
        assert_eq!(day_number("1970-01-01"), Some(0));
        assert_eq!(day_number("2000-03-01"), Some(11017));
        assert_eq!(day_number("2026-02-29"), None);
        assert_eq!(day_number("2028-02-29").unwrap() - day_number("2028-02-28").unwrap(), 1);
    }

    #[test] fn dates() {
        let r = Rent { deposit: 0, min_days: 2, units: None, booked: vec![rg("2026-12-24", "2026-12-26", None)] };
        assert!(check("2026-12-20", "2026-12-22", 1, &r).ok);
        assert_eq!(check("2026-12-20", "2026-12-22", 1, &r).days, 3);
        assert!(!check("2026-12-20", "2026-12-20", 1, &r).ok);
        assert!(!check("2026-12-23", "2026-12-24", 1, &r).ok);
        assert!(!check("2026-12-26", "2026-12-25", 1, &r).ok);
        assert!(check("2026-12-27", "2026-12-28", 1, &r).ok);
    }

    #[test] fn chairs_by_quantity() {
        // 300 chairs; 200 out on the 24th–25th, 150 out on the 25th–26th → 0 free on the 25th
        let r = Rent { deposit: 0, min_days: 1, units: Some(300), booked: vec![rg("2026-12-24", "2026-12-25", Some(200)), rg("2026-12-25", "2026-12-26", Some(100))] };
        assert_eq!(check("2026-12-24", "2026-12-24", 100, &r), DateCheck { ok: true, days: 1, free: 100, error: None });
        assert!(!check("2026-12-24", "2026-12-24", 101, &r).ok);
        assert_eq!(check("2026-12-24", "2026-12-26", 1, &r).free, 0);
        assert!(!check("2026-12-25", "2026-12-25", 1, &r).ok);
        assert_eq!(check("2026-12-26", "2026-12-27", 200, &r).free, 200);
        assert_eq!(check("2026-12-01", "2026-12-01", 300, &r).free, 300);
        assert!(!check("2026-12-01", "2026-12-01", 301, &r).ok);
    }

    #[test] fn cart_lines_share_stock() {
        let mut c = cat();
        c.products.push(Product { id: "chair".into(), title: "Chair".into(), house: "sandals".into(), mode: "rent".into(), price: 30_000, stock: "in".into(),
            rent: Some(Rent { deposit: 0, min_days: 1, units: Some(100), booked: vec![] }), sale: None });
        let two = [Item { id: "chair".into(), qty: 60, from: "2026-12-01".into(), to: "2026-12-01".into(), opt: "".into() },
                   Item { id: "chair".into(), qty: 50, from: "2026-12-01".into(), to: "2026-12-01".into(), opt: "White".into() }];
        assert!(!price(&c, &two).ok); // 110 > 100 across two lines
        assert_eq!(price(&c, &two[..1]).lines[0].total, 60 * 30_000);
    }

    #[test] fn quote_splits_houses() {
        let q = price(&cat(), &[it("kano", 2, "", ""), it("bridal", 1, "2026-12-20", "2026-12-22"), it("oud", 1, "", "")]);
        let s = q.houses.iter().find(|h| h.house == "sandals").unwrap();
        assert_eq!(s.subtotal, 5_000_000 + 1_500_000);
        assert_eq!(s.deposits, 2_000_000);
        assert_eq!(s.total, 8_500_000);
        assert!(!q.ok); // oud is sold out
        assert_eq!(q.lines[2].error.as_deref(), Some("Sold out"));
        assert_eq!(q.houses.iter().find(|h| h.house == "scents").unwrap().total, 0);
    }

    #[test] fn offers_apply_until_they_end() {
        let mut c = cat();
        c.products[0].sale = Some(Sale { price: 2_150_000, ends: "2026-11-30".into() }); // kano 25,000 → 21,500
        let cart = [it("kano", 2, "", "")];
        c.today = "2026-11-30".into();
        let q = price(&c, &cart);
        assert_eq!((q.lines[0].unit, q.lines[0].was, q.lines[0].total, q.lines[0].saved), (2_150_000, 2_500_000, 4_300_000, 700_000));
        assert_eq!(q.houses[0].saved, 700_000);
        let m = compose(&q, "sandals", "x/", "", "");
        assert!(m.contains("= ₦43,000 (save ₦7,000)"), "{m}");
        assert!(m.contains("You save: ₦7,000"));
        c.today = "2026-12-01".into(); // the day after: regular price, no "was"
        let q = price(&c, &cart);
        assert_eq!((q.lines[0].unit, q.lines[0].was, q.lines[0].saved), (2_500_000, 0, 0));
        // a "sale" that isn't cheaper is ignored
        c.products[0].sale = Some(Sale { price: 3_000_000, ends: String::new() });
        assert_eq!(price(&c, &cart).lines[0].unit, 2_500_000);
    }

    #[test] fn percent_off_rounds_down_to_step() {
        assert_eq!(percent_off(2_200_000, 15, 50_000), 1_850_000); // ₦22,000 −15% = 18,700 → ₦18,500
        assert_eq!(percent_off(2_900_000, 15, 50_000), 2_450_000); // ₦29,000 → ₦24,500
        assert_eq!(percent_off(1_000, 10, 0), 900);
        assert_eq!(percent_off(1_000, 150, 0), 0);
    }

    #[test] fn money_format() {
        assert_eq!(money(2_500_000, "NGN"), "₦25,000");
        assert_eq!(money(1999, "USD"), "$19.99");
        assert_eq!(money(100_000_000, "NGN"), "₦1,000,000");
        assert_eq!(money(5, "XOF"), "XOF0.05");
    }

    #[test] fn codes_stable_and_checked() {
        let a = [it("kano", 2, "", ""), it("bridal", 1, "2026-12-20", "2026-12-22")];
        let b = [it("bridal", 1, "2026-12-20", "2026-12-22"), it("kano", 2, "", "")];
        assert_eq!(code(&a), code(&b));
        assert!(valid_code(&code(&a)));
        assert_ne!(code(&a), code(&a[..1]));
        let mut bad = code(&a); bad.pop(); bad.push(if bad.ends_with('0') { '1' } else { '0' });
        assert!(!valid_code(&bad) || bad == code(&a));
    }

    #[test] fn link_roundtrip() {
        let a = vec![it("kano", 2, "", ""), Item { id: "oud".into(), qty: 1, opt: "50 ml · gift ✨".into(), ..Default::default() }];
        let d = decode(&encode(&a));
        assert_eq!(d.len(), 2);
        assert_eq!(d[1].opt, "50 ml · gift ✨");
        assert_eq!(d[0].qty, 2);
    }

    #[test] fn message_reads_well() {
        let q = price(&cat(), &[it("kano", 2, "", ""), it("bridal", 1, "2026-12-20", "2026-12-22")]);
        let m = compose(&q, "sandals", "https://obiverse.github.io/shop/order/", "Ada", "");
        assert!(m.starts_with("Hello Obi Sandals!"));
        assert!(m.contains("2 × Kano Slide (42) = ₦50,000"));
        assert!(m.contains("(3 days) = ₦15,000"));
        assert!(m.contains("Total: ₦85,000"));
        assert!(m.contains("Name: Ada"));
        assert!(m.contains("/shop/order/#"));
    }
}
