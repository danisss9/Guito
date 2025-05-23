var Kn = Object.defineProperty;
var qn = (n, e, t) =>
  e in n ? Kn(n, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : (n[e] = t);
var rn = (n, e, t) => qn(n, typeof e != 'symbol' ? e + '' : e, t);
(function () {
  const e = document.createElement('link').relList;
  if (e && e.supports && e.supports('modulepreload')) return;
  for (const i of document.querySelectorAll('link[rel="modulepreload"]')) r(i);
  new MutationObserver((i) => {
    for (const a of i)
      if (a.type === 'childList')
        for (const s of a.addedNodes) s.tagName === 'LINK' && s.rel === 'modulepreload' && r(s);
  }).observe(document, { childList: !0, subtree: !0 });
  function t(i) {
    const a = {};
    return (
      i.integrity && (a.integrity = i.integrity),
      i.referrerPolicy && (a.referrerPolicy = i.referrerPolicy),
      i.crossOrigin === 'use-credentials'
        ? (a.credentials = 'include')
        : i.crossOrigin === 'anonymous'
        ? (a.credentials = 'omit')
        : (a.credentials = 'same-origin'),
      a
    );
  }
  function r(i) {
    if (i.ep) return;
    i.ep = !0;
    const a = t(i);
    fetch(i.href, a);
  }
})();
function Ne() {}
function F(n, e) {
  for (const t in e) n[t] = e[t];
  return n;
}
function Wn(n) {
  return n();
}
function _n() {
  return Object.create(null);
}
function he(n) {
  n.forEach(Wn);
}
function me(n) {
  return typeof n == 'function';
}
function _e(n, e) {
  return n != n ? e == e : n !== e || (n && typeof n == 'object') || typeof n == 'function';
}
function Xn(n) {
  return Object.keys(n).length === 0;
}
function Zn(n, ...e) {
  if (n == null) {
    for (const r of e) r(void 0);
    return Ne;
  }
  const t = n.subscribe(...e);
  return t.unsubscribe ? () => t.unsubscribe() : t;
}
function Qe(n, e, t) {
  n.$$.on_destroy.push(Zn(e, t));
}
function Ee(n, e, t, r) {
  if (n) {
    const i = Fn(n, e, t, r);
    return n[0](i);
  }
}
function Fn(n, e, t, r) {
  return n[1] && r ? F(t.ctx.slice(), n[1](r(e))) : t.ctx;
}
function be(n, e, t, r) {
  if (n[2] && r) {
    const i = n[2](r(t));
    if (e.dirty === void 0) return i;
    if (typeof i == 'object') {
      const a = [],
        s = Math.max(e.dirty.length, i.length);
      for (let o = 0; o < s; o += 1) a[o] = e.dirty[o] | i[o];
      return a;
    }
    return e.dirty | i;
  }
  return e.dirty;
}
function ve(n, e, t, r, i, a) {
  if (i) {
    const s = Fn(e, t, r, a);
    n.p(s, i);
  }
}
function Ae(n) {
  if (n.ctx.length > 32) {
    const e = [],
      t = n.ctx.length / 32;
    for (let r = 0; r < t; r++) e[r] = -1;
    return e;
  }
  return -1;
}
function Ge(n) {
  const e = {};
  for (const t in n) t[0] !== '$' && (e[t] = n[t]);
  return e;
}
function re(n, e) {
  const t = {};
  e = new Set(e);
  for (const r in n) !e.has(r) && r[0] !== '$' && (t[r] = n[r]);
  return t;
}
function Qn(n) {
  const e = {};
  for (const t in n) e[t] = !0;
  return e;
}
function jt(n, e, t) {
  return n.set(t), e;
}
function ee(n) {
  return n && me(n.destroy) ? n.destroy : Ne;
}
function $(n, e) {
  n.appendChild(e);
}
function I(n, e, t) {
  n.insertBefore(e, t || null);
}
function D(n) {
  n.parentNode && n.parentNode.removeChild(n);
}
function Jn(n, e) {
  for (let t = 0; t < n.length; t += 1) n[t] && n[t].d(e);
}
function J(n) {
  return document.createElement(n);
}
function Vt(n) {
  return document.createElementNS('http://www.w3.org/2000/svg', n);
}
function ne(n) {
  return document.createTextNode(n);
}
function Y() {
  return ne(' ');
}
function Ve() {
  return ne('');
}
function ie(n, e, t, r) {
  return n.addEventListener(e, t, r), () => n.removeEventListener(e, t, r);
}
function Q(n, e, t) {
  t == null ? n.removeAttribute(e) : n.getAttribute(e) !== t && n.setAttribute(e, t);
}
const Yn = ['width', 'height'];
function te(n, e) {
  const t = Object.getOwnPropertyDescriptors(n.__proto__);
  for (const r in e)
    e[r] == null
      ? n.removeAttribute(r)
      : r === 'style'
      ? (n.style.cssText = e[r])
      : r === '__value'
      ? (n.value = n[r] = e[r])
      : t[r] && t[r].set && Yn.indexOf(r) === -1
      ? (n[r] = e[r])
      : Q(n, r, e[r]);
}
function Kt(n, e) {
  for (const t in e) Q(n, t, e[t]);
}
function xn(n, e) {
  Object.keys(e).forEach((t) => {
    $n(n, t, e[t]);
  });
}
function $n(n, e, t) {
  const r = e.toLowerCase();
  r in n
    ? (n[r] = typeof n[r] == 'boolean' && t === '' ? !0 : t)
    : e in n
    ? (n[e] = typeof n[e] == 'boolean' && t === '' ? !0 : t)
    : Q(n, e, t);
}
function qt(n) {
  return /-/.test(n) ? xn : te;
}
function er(n) {
  return Array.from(n.childNodes);
}
function Ot(n, e) {
  (e = '' + e), n.data !== e && (n.data = e);
}
function Xt(n, e) {
  return new n(e);
}
let St;
function yt(n) {
  St = n;
}
function Ce() {
  if (!St) throw new Error('Function called outside component initialization');
  return St;
}
function $e(n) {
  Ce().$$.on_mount.push(n);
}
function xt(n) {
  Ce().$$.on_destroy.push(n);
}
function de(n, e) {
  return Ce().$$.context.set(n, e), e;
}
function ye(n) {
  return Ce().$$.context.get(n);
}
const dt = [],
  fe = [];
let ht = [];
const gn = [],
  tr = Promise.resolve();
let fn = !1;
function nr() {
  fn || ((fn = !0), tr.then(Gn));
}
function hn(n) {
  ht.push(n);
}
const an = new Set();
let ut = 0;
function Gn() {
  if (ut !== 0) return;
  const n = St;
  do {
    try {
      for (; ut < dt.length; ) {
        const e = dt[ut];
        ut++, yt(e), rr(e.$$);
      }
    } catch (e) {
      throw ((dt.length = 0), (ut = 0), e);
    }
    for (yt(null), dt.length = 0, ut = 0; fe.length; ) fe.pop()();
    for (let e = 0; e < ht.length; e += 1) {
      const t = ht[e];
      an.has(t) || (an.add(t), t());
    }
    ht.length = 0;
  } while (dt.length);
  for (; gn.length; ) gn.pop()();
  (fn = !1), an.clear(), yt(n);
}
function rr(n) {
  if (n.fragment !== null) {
    n.update(), he(n.before_update);
    const e = n.dirty;
    (n.dirty = [-1]), n.fragment && n.fragment.p(n.ctx, e), n.after_update.forEach(hn);
  }
}
function ir(n) {
  const e = [],
    t = [];
  ht.forEach((r) => (n.indexOf(r) === -1 ? e.push(r) : t.push(r))), t.forEach((r) => r()), (ht = e);
}
const zt = new Set();
let ot;
function et() {
  ot = { r: 0, c: [], p: ot };
}
function tt() {
  ot.r || he(ot.c), (ot = ot.p);
}
function w(n, e) {
  n && n.i && (zt.delete(n), n.i(e));
}
function L(n, e, t, r) {
  if (n && n.o) {
    if (zt.has(n)) return;
    zt.add(n),
      ot.c.push(() => {
        zt.delete(n), r && (t && n.d(1), r());
      }),
      n.o(e);
  } else r && r();
}
function Zt(n) {
  return (n == null ? void 0 : n.length) !== void 0 ? n : Array.from(n);
}
function ar(n, e) {
  L(n, 1, 1, () => {
    e.delete(n.key);
  });
}
function or(n, e, t, r, i, a, s, o, l, u, d, c) {
  let f = n.length,
    g = a.length,
    _ = f;
  const E = {};
  for (; _--; ) E[n[_].key] = _;
  const p = [],
    v = new Map(),
    A = new Map(),
    H = [];
  for (_ = g; _--; ) {
    const S = c(i, a, _),
      W = t(S);
    let G = s.get(W);
    G ? H.push(() => G.p(S, e)) : ((G = u(W, S)), G.c()),
      v.set(W, (p[_] = G)),
      W in E && A.set(W, Math.abs(_ - E[W]));
  }
  const b = new Set(),
    C = new Set();
  function k(S) {
    w(S, 1), S.m(o, d), s.set(S.key, S), (d = S.first), g--;
  }
  for (; f && g; ) {
    const S = p[g - 1],
      W = n[f - 1],
      G = S.key,
      T = W.key;
    S === W
      ? ((d = S.first), f--, g--)
      : v.has(T)
      ? !s.has(G) || b.has(G)
        ? k(S)
        : C.has(T)
        ? f--
        : A.get(G) > A.get(T)
        ? (C.add(G), k(S))
        : (b.add(T), f--)
      : (l(W, s), f--);
  }
  for (; f--; ) {
    const S = n[f];
    v.has(S.key) || l(S, s);
  }
  for (; g; ) k(p[g - 1]);
  return he(H), p;
}
function le(n, e) {
  const t = {},
    r = {},
    i = { $$scope: 1 };
  let a = n.length;
  for (; a--; ) {
    const s = n[a],
      o = e[a];
    if (o) {
      for (const l in s) l in o || (r[l] = 1);
      for (const l in o) i[l] || ((t[l] = o[l]), (i[l] = 1));
      n[a] = o;
    } else for (const l in s) i[l] = 1;
  }
  for (const s in r) s in t || (t[s] = void 0);
  return t;
}
function je(n) {
  return typeof n == 'object' && n !== null ? n : {};
}
function K(n) {
  n && n.c();
}
function z(n, e, t) {
  const { fragment: r, after_update: i } = n.$$;
  r && r.m(e, t),
    hn(() => {
      const a = n.$$.on_mount.map(Wn).filter(me);
      n.$$.on_destroy ? n.$$.on_destroy.push(...a) : he(a), (n.$$.on_mount = []);
    }),
    i.forEach(hn);
}
function j(n, e) {
  const t = n.$$;
  t.fragment !== null &&
    (ir(t.after_update),
    he(t.on_destroy),
    t.fragment && t.fragment.d(e),
    (t.on_destroy = t.fragment = null),
    (t.ctx = []));
}
function sr(n, e) {
  n.$$.dirty[0] === -1 && (dt.push(n), nr(), n.$$.dirty.fill(0)),
    (n.$$.dirty[(e / 31) | 0] |= 1 << e % 31);
}
function we(n, e, t, r, i, a, s = null, o = [-1]) {
  const l = St;
  yt(n);
  const u = (n.$$ = {
    fragment: null,
    ctx: [],
    props: a,
    update: Ne,
    not_equal: i,
    bound: _n(),
    on_mount: [],
    on_destroy: [],
    on_disconnect: [],
    before_update: [],
    after_update: [],
    context: new Map(e.context || (l ? l.$$.context : [])),
    callbacks: _n(),
    dirty: o,
    skip_bound: !1,
    root: e.target || l.$$.root,
  });
  s && s(u.root);
  let d = !1;
  if (
    ((u.ctx = t
      ? t(n, e.props || {}, (c, f, ...g) => {
          const _ = g.length ? g[0] : f;
          return (
            u.ctx &&
              i(u.ctx[c], (u.ctx[c] = _)) &&
              (!u.skip_bound && u.bound[c] && u.bound[c](_), d && sr(n, c)),
            f
          );
        })
      : []),
    u.update(),
    (d = !0),
    he(u.before_update),
    (u.fragment = r ? r(u.ctx) : !1),
    e.target)
  ) {
    if (e.hydrate) {
      const c = er(e.target);
      u.fragment && u.fragment.l(c), c.forEach(D);
    } else u.fragment && u.fragment.c();
    e.intro && w(n.$$.fragment), z(n, e.target, e.anchor), Gn();
  }
  yt(l);
}
class Ie {
  constructor() {
    rn(this, '$$');
    rn(this, '$$set');
  }
  $destroy() {
    j(this, 1), (this.$destroy = Ne);
  }
  $on(e, t) {
    if (!me(t)) return Ne;
    const r = this.$$.callbacks[e] || (this.$$.callbacks[e] = []);
    return (
      r.push(t),
      () => {
        const i = r.indexOf(t);
        i !== -1 && r.splice(i, 1);
      }
    );
  }
  $set(e) {
    this.$$set && !Xn(e) && ((this.$$.skip_bound = !0), this.$$set(e), (this.$$.skip_bound = !1));
  }
}
const lr = '4';
typeof window < 'u' && (window.__svelte || (window.__svelte = { v: new Set() })).v.add(lr);
var pn = function (n, e) {
  return (
    (pn =
      Object.setPrototypeOf ||
      ({ __proto__: [] } instanceof Array &&
        function (t, r) {
          t.__proto__ = r;
        }) ||
      function (t, r) {
        for (var i in r) Object.prototype.hasOwnProperty.call(r, i) && (t[i] = r[i]);
      }),
    pn(n, e)
  );
};
function Rt(n, e) {
  if (typeof e != 'function' && e !== null)
    throw new TypeError('Class extends value ' + String(e) + ' is not a constructor or null');
  pn(n, e);
  function t() {
    this.constructor = n;
  }
  n.prototype = e === null ? Object.create(e) : ((t.prototype = e.prototype), new t());
}
var Me = function () {
  return (
    (Me =
      Object.assign ||
      function (e) {
        for (var t, r = 1, i = arguments.length; r < i; r++) {
          t = arguments[r];
          for (var a in t) Object.prototype.hasOwnProperty.call(t, a) && (e[a] = t[a]);
        }
        return e;
      }),
    Me.apply(this, arguments)
  );
};
function ur(n, e, t, r) {
  function i(a) {
    return a instanceof t
      ? a
      : new t(function (s) {
          s(a);
        });
  }
  return new (t || (t = Promise))(function (a, s) {
    function o(d) {
      try {
        u(r.next(d));
      } catch (c) {
        s(c);
      }
    }
    function l(d) {
      try {
        u(r.throw(d));
      } catch (c) {
        s(c);
      }
    }
    function u(d) {
      d.done ? a(d.value) : i(d.value).then(o, l);
    }
    u((r = r.apply(n, e || [])).next());
  });
}
function cr(n, e) {
  var t = {
      label: 0,
      sent: function () {
        if (a[0] & 1) throw a[1];
        return a[1];
      },
      trys: [],
      ops: [],
    },
    r,
    i,
    a,
    s;
  return (
    (s = { next: o(0), throw: o(1), return: o(2) }),
    typeof Symbol == 'function' &&
      (s[Symbol.iterator] = function () {
        return this;
      }),
    s
  );
  function o(u) {
    return function (d) {
      return l([u, d]);
    };
  }
  function l(u) {
    if (r) throw new TypeError('Generator is already executing.');
    for (; s && ((s = 0), u[0] && (t = 0)), t; )
      try {
        if (
          ((r = 1),
          i &&
            (a =
              u[0] & 2 ? i.return : u[0] ? i.throw || ((a = i.return) && a.call(i), 0) : i.next) &&
            !(a = a.call(i, u[1])).done)
        )
          return a;
        switch (((i = 0), a && (u = [u[0] & 2, a.value]), u[0])) {
          case 0:
          case 1:
            a = u;
            break;
          case 4:
            return t.label++, { value: u[1], done: !1 };
          case 5:
            t.label++, (i = u[1]), (u = [0]);
            continue;
          case 7:
            (u = t.ops.pop()), t.trys.pop();
            continue;
          default:
            if (
              ((a = t.trys), !(a = a.length > 0 && a[a.length - 1]) && (u[0] === 6 || u[0] === 2))
            ) {
              t = 0;
              continue;
            }
            if (u[0] === 3 && (!a || (u[1] > a[0] && u[1] < a[3]))) {
              t.label = u[1];
              break;
            }
            if (u[0] === 6 && t.label < a[1]) {
              (t.label = a[1]), (a = u);
              break;
            }
            if (a && t.label < a[2]) {
              (t.label = a[2]), t.ops.push(u);
              break;
            }
            a[2] && t.ops.pop(), t.trys.pop();
            continue;
        }
        u = e.call(n, t);
      } catch (d) {
        (u = [6, d]), (i = 0);
      } finally {
        r = a = 0;
      }
    if (u[0] & 5) throw u[1];
    return { value: u[0] ? u[1] : void 0, done: !0 };
  }
}
function Ue(n) {
  var e = typeof Symbol == 'function' && Symbol.iterator,
    t = e && n[e],
    r = 0;
  if (t) return t.call(n);
  if (n && typeof n.length == 'number')
    return {
      next: function () {
        return n && r >= n.length && (n = void 0), { value: n && n[r++], done: !n };
      },
    };
  throw new TypeError(e ? 'Object is not iterable.' : 'Symbol.iterator is not defined.');
}
/**
 * @license
 * Copyright 2016 Google Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */ var Dt = (function () {
  function n(e) {
    e === void 0 && (e = {}), (this.adapter = e);
  }
  return (
    Object.defineProperty(n, 'cssClasses', {
      get: function () {
        return {};
      },
      enumerable: !1,
      configurable: !0,
    }),
    Object.defineProperty(n, 'strings', {
      get: function () {
        return {};
      },
      enumerable: !1,
      configurable: !0,
    }),
    Object.defineProperty(n, 'numbers', {
      get: function () {
        return {};
      },
      enumerable: !1,
      configurable: !0,
    }),
    Object.defineProperty(n, 'defaultAdapter', {
      get: function () {
        return {};
      },
      enumerable: !1,
      configurable: !0,
    }),
    (n.prototype.init = function () {}),
    (n.prototype.destroy = function () {}),
    n
  );
})();
/**
 * @license
 * Copyright 2019 Google Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */ function dr(n) {
  return n === void 0 && (n = window), fr(n) ? { passive: !0 } : !1;
}
function fr(n) {
  n === void 0 && (n = window);
  var e = !1;
  try {
    var t = {
        get passive() {
          return (e = !0), !1;
        },
      },
      r = function () {};
    n.document.addEventListener('test', r, t), n.document.removeEventListener('test', r, t);
  } catch {
    e = !1;
  }
  return e;
}
const hr = Object.freeze(
  Object.defineProperty({ __proto__: null, applyPassive: dr }, Symbol.toStringTag, {
    value: 'Module',
  })
);
/**
 * @license
 * Copyright 2018 Google Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */ function pr(n, e) {
  if (n.closest) return n.closest(e);
  for (var t = n; t; ) {
    if (Vn(t, e)) return t;
    t = t.parentElement;
  }
  return null;
}
function Vn(n, e) {
  var t = n.matches || n.webkitMatchesSelector || n.msMatchesSelector;
  return t.call(n, e);
}
function mr(n) {
  var e = n;
  if (e.offsetParent !== null) return e.scrollWidth;
  var t = e.cloneNode(!0);
  t.style.setProperty('position', 'absolute'),
    t.style.setProperty('transform', 'translate(-9999px, -9999px)'),
    document.documentElement.appendChild(t);
  var r = t.scrollWidth;
  return document.documentElement.removeChild(t), r;
}
const zn = Object.freeze(
  Object.defineProperty(
    { __proto__: null, closest: pr, estimateScrollWidth: mr, matches: Vn },
    Symbol.toStringTag,
    { value: 'Module' }
  )
);
/**
 * @license
 * Copyright 2016 Google Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */ var _r = {
    BG_FOCUSED: 'mdc-ripple-upgraded--background-focused',
    FG_ACTIVATION: 'mdc-ripple-upgraded--foreground-activation',
    FG_DEACTIVATION: 'mdc-ripple-upgraded--foreground-deactivation',
    ROOT: 'mdc-ripple-upgraded',
    UNBOUNDED: 'mdc-ripple-upgraded--unbounded',
  },
  gr = {
    VAR_FG_SCALE: '--mdc-ripple-fg-scale',
    VAR_FG_SIZE: '--mdc-ripple-fg-size',
    VAR_FG_TRANSLATE_END: '--mdc-ripple-fg-translate-end',
    VAR_FG_TRANSLATE_START: '--mdc-ripple-fg-translate-start',
    VAR_LEFT: '--mdc-ripple-left',
    VAR_TOP: '--mdc-ripple-top',
  },
  En = {
    DEACTIVATION_TIMEOUT_MS: 225,
    FG_DEACTIVATION_MS: 150,
    INITIAL_ORIGIN_SCALE: 0.6,
    PADDING: 10,
    TAP_DELAY_MS: 300,
  },
  Nt;
function Er(n, e) {
  e === void 0 && (e = !1);
  var t = n.CSS,
    r = Nt;
  if (typeof Nt == 'boolean' && !e) return Nt;
  var i = t && typeof t.supports == 'function';
  if (!i) return !1;
  var a = t.supports('--css-vars', 'yes'),
    s = t.supports('(--css-vars: yes)') && t.supports('color', '#00000000');
  return (r = a || s), e || (Nt = r), r;
}
function br(n, e, t) {
  if (!n) return { x: 0, y: 0 };
  var r = e.x,
    i = e.y,
    a = r + t.left,
    s = i + t.top,
    o,
    l;
  if (n.type === 'touchstart') {
    var u = n;
    (o = u.changedTouches[0].pageX - a), (l = u.changedTouches[0].pageY - s);
  } else {
    var d = n;
    (o = d.pageX - a), (l = d.pageY - s);
  }
  return { x: o, y: l };
}
/**
 * @license
 * Copyright 2016 Google Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */ var bn = ['touchstart', 'pointerdown', 'mousedown', 'keydown'],
  vn = ['touchend', 'pointerup', 'mouseup', 'contextmenu'],
  Mt = [],
  vr = (function (n) {
    Rt(e, n);
    function e(t) {
      var r = n.call(this, Me(Me({}, e.defaultAdapter), t)) || this;
      return (
        (r.activationAnimationHasEnded = !1),
        (r.activationTimer = 0),
        (r.fgDeactivationRemovalTimer = 0),
        (r.fgScale = '0'),
        (r.frame = { width: 0, height: 0 }),
        (r.initialSize = 0),
        (r.layoutFrame = 0),
        (r.maxRadius = 0),
        (r.unboundedCoords = { left: 0, top: 0 }),
        (r.activationState = r.defaultActivationState()),
        (r.activationTimerCallback = function () {
          (r.activationAnimationHasEnded = !0), r.runDeactivationUXLogicIfReady();
        }),
        (r.activateHandler = function (i) {
          r.activateImpl(i);
        }),
        (r.deactivateHandler = function () {
          r.deactivateImpl();
        }),
        (r.focusHandler = function () {
          r.handleFocus();
        }),
        (r.blurHandler = function () {
          r.handleBlur();
        }),
        (r.resizeHandler = function () {
          r.layout();
        }),
        r
      );
    }
    return (
      Object.defineProperty(e, 'cssClasses', {
        get: function () {
          return _r;
        },
        enumerable: !1,
        configurable: !0,
      }),
      Object.defineProperty(e, 'strings', {
        get: function () {
          return gr;
        },
        enumerable: !1,
        configurable: !0,
      }),
      Object.defineProperty(e, 'numbers', {
        get: function () {
          return En;
        },
        enumerable: !1,
        configurable: !0,
      }),
      Object.defineProperty(e, 'defaultAdapter', {
        get: function () {
          return {
            addClass: function () {},
            browserSupportsCssVars: function () {
              return !0;
            },
            computeBoundingRect: function () {
              return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 };
            },
            containsEventTarget: function () {
              return !0;
            },
            deregisterDocumentInteractionHandler: function () {},
            deregisterInteractionHandler: function () {},
            deregisterResizeHandler: function () {},
            getWindowPageOffset: function () {
              return { x: 0, y: 0 };
            },
            isSurfaceActive: function () {
              return !0;
            },
            isSurfaceDisabled: function () {
              return !0;
            },
            isUnbounded: function () {
              return !0;
            },
            registerDocumentInteractionHandler: function () {},
            registerInteractionHandler: function () {},
            registerResizeHandler: function () {},
            removeClass: function () {},
            updateCssVariable: function () {},
          };
        },
        enumerable: !1,
        configurable: !0,
      }),
      (e.prototype.init = function () {
        var t = this,
          r = this.supportsPressRipple();
        if ((this.registerRootHandlers(r), r)) {
          var i = e.cssClasses,
            a = i.ROOT,
            s = i.UNBOUNDED;
          requestAnimationFrame(function () {
            t.adapter.addClass(a),
              t.adapter.isUnbounded() && (t.adapter.addClass(s), t.layoutInternal());
          });
        }
      }),
      (e.prototype.destroy = function () {
        var t = this;
        if (this.supportsPressRipple()) {
          this.activationTimer &&
            (clearTimeout(this.activationTimer),
            (this.activationTimer = 0),
            this.adapter.removeClass(e.cssClasses.FG_ACTIVATION)),
            this.fgDeactivationRemovalTimer &&
              (clearTimeout(this.fgDeactivationRemovalTimer),
              (this.fgDeactivationRemovalTimer = 0),
              this.adapter.removeClass(e.cssClasses.FG_DEACTIVATION));
          var r = e.cssClasses,
            i = r.ROOT,
            a = r.UNBOUNDED;
          requestAnimationFrame(function () {
            t.adapter.removeClass(i), t.adapter.removeClass(a), t.removeCssVars();
          });
        }
        this.deregisterRootHandlers(), this.deregisterDeactivationHandlers();
      }),
      (e.prototype.activate = function (t) {
        this.activateImpl(t);
      }),
      (e.prototype.deactivate = function () {
        this.deactivateImpl();
      }),
      (e.prototype.layout = function () {
        var t = this;
        this.layoutFrame && cancelAnimationFrame(this.layoutFrame),
          (this.layoutFrame = requestAnimationFrame(function () {
            t.layoutInternal(), (t.layoutFrame = 0);
          }));
      }),
      (e.prototype.setUnbounded = function (t) {
        var r = e.cssClasses.UNBOUNDED;
        t ? this.adapter.addClass(r) : this.adapter.removeClass(r);
      }),
      (e.prototype.handleFocus = function () {
        var t = this;
        requestAnimationFrame(function () {
          return t.adapter.addClass(e.cssClasses.BG_FOCUSED);
        });
      }),
      (e.prototype.handleBlur = function () {
        var t = this;
        requestAnimationFrame(function () {
          return t.adapter.removeClass(e.cssClasses.BG_FOCUSED);
        });
      }),
      (e.prototype.supportsPressRipple = function () {
        return this.adapter.browserSupportsCssVars();
      }),
      (e.prototype.defaultActivationState = function () {
        return {
          activationEvent: void 0,
          hasDeactivationUXRun: !1,
          isActivated: !1,
          isProgrammatic: !1,
          wasActivatedByPointer: !1,
          wasElementMadeActive: !1,
        };
      }),
      (e.prototype.registerRootHandlers = function (t) {
        var r, i;
        if (t) {
          try {
            for (var a = Ue(bn), s = a.next(); !s.done; s = a.next()) {
              var o = s.value;
              this.adapter.registerInteractionHandler(o, this.activateHandler);
            }
          } catch (l) {
            r = { error: l };
          } finally {
            try {
              s && !s.done && (i = a.return) && i.call(a);
            } finally {
              if (r) throw r.error;
            }
          }
          this.adapter.isUnbounded() && this.adapter.registerResizeHandler(this.resizeHandler);
        }
        this.adapter.registerInteractionHandler('focus', this.focusHandler),
          this.adapter.registerInteractionHandler('blur', this.blurHandler);
      }),
      (e.prototype.registerDeactivationHandlers = function (t) {
        var r, i;
        if (t.type === 'keydown')
          this.adapter.registerInteractionHandler('keyup', this.deactivateHandler);
        else
          try {
            for (var a = Ue(vn), s = a.next(); !s.done; s = a.next()) {
              var o = s.value;
              this.adapter.registerDocumentInteractionHandler(o, this.deactivateHandler);
            }
          } catch (l) {
            r = { error: l };
          } finally {
            try {
              s && !s.done && (i = a.return) && i.call(a);
            } finally {
              if (r) throw r.error;
            }
          }
      }),
      (e.prototype.deregisterRootHandlers = function () {
        var t, r;
        try {
          for (var i = Ue(bn), a = i.next(); !a.done; a = i.next()) {
            var s = a.value;
            this.adapter.deregisterInteractionHandler(s, this.activateHandler);
          }
        } catch (o) {
          t = { error: o };
        } finally {
          try {
            a && !a.done && (r = i.return) && r.call(i);
          } finally {
            if (t) throw t.error;
          }
        }
        this.adapter.deregisterInteractionHandler('focus', this.focusHandler),
          this.adapter.deregisterInteractionHandler('blur', this.blurHandler),
          this.adapter.isUnbounded() && this.adapter.deregisterResizeHandler(this.resizeHandler);
      }),
      (e.prototype.deregisterDeactivationHandlers = function () {
        var t, r;
        this.adapter.deregisterInteractionHandler('keyup', this.deactivateHandler);
        try {
          for (var i = Ue(vn), a = i.next(); !a.done; a = i.next()) {
            var s = a.value;
            this.adapter.deregisterDocumentInteractionHandler(s, this.deactivateHandler);
          }
        } catch (o) {
          t = { error: o };
        } finally {
          try {
            a && !a.done && (r = i.return) && r.call(i);
          } finally {
            if (t) throw t.error;
          }
        }
      }),
      (e.prototype.removeCssVars = function () {
        var t = this,
          r = e.strings,
          i = Object.keys(r);
        i.forEach(function (a) {
          a.indexOf('VAR_') === 0 && t.adapter.updateCssVariable(r[a], null);
        });
      }),
      (e.prototype.activateImpl = function (t) {
        var r = this;
        if (!this.adapter.isSurfaceDisabled()) {
          var i = this.activationState;
          if (!i.isActivated) {
            var a = this.previousActivationEvent,
              s = a && t !== void 0 && a.type !== t.type;
            if (!s) {
              (i.isActivated = !0),
                (i.isProgrammatic = t === void 0),
                (i.activationEvent = t),
                (i.wasActivatedByPointer = i.isProgrammatic
                  ? !1
                  : t !== void 0 &&
                    (t.type === 'mousedown' ||
                      t.type === 'touchstart' ||
                      t.type === 'pointerdown'));
              var o =
                t !== void 0 &&
                Mt.length > 0 &&
                Mt.some(function (l) {
                  return r.adapter.containsEventTarget(l);
                });
              if (o) {
                this.resetActivationState();
                return;
              }
              t !== void 0 && (Mt.push(t.target), this.registerDeactivationHandlers(t)),
                (i.wasElementMadeActive = this.checkElementMadeActive(t)),
                i.wasElementMadeActive && this.animateActivation(),
                requestAnimationFrame(function () {
                  (Mt = []),
                    !i.wasElementMadeActive &&
                      t !== void 0 &&
                      (t.key === ' ' || t.keyCode === 32) &&
                      ((i.wasElementMadeActive = r.checkElementMadeActive(t)),
                      i.wasElementMadeActive && r.animateActivation()),
                    i.wasElementMadeActive || (r.activationState = r.defaultActivationState());
                });
            }
          }
        }
      }),
      (e.prototype.checkElementMadeActive = function (t) {
        return t !== void 0 && t.type === 'keydown' ? this.adapter.isSurfaceActive() : !0;
      }),
      (e.prototype.animateActivation = function () {
        var t = this,
          r = e.strings,
          i = r.VAR_FG_TRANSLATE_START,
          a = r.VAR_FG_TRANSLATE_END,
          s = e.cssClasses,
          o = s.FG_DEACTIVATION,
          l = s.FG_ACTIVATION,
          u = e.numbers.DEACTIVATION_TIMEOUT_MS;
        this.layoutInternal();
        var d = '',
          c = '';
        if (!this.adapter.isUnbounded()) {
          var f = this.getFgTranslationCoordinates(),
            g = f.startPoint,
            _ = f.endPoint;
          (d = g.x + 'px, ' + g.y + 'px'), (c = _.x + 'px, ' + _.y + 'px');
        }
        this.adapter.updateCssVariable(i, d),
          this.adapter.updateCssVariable(a, c),
          clearTimeout(this.activationTimer),
          clearTimeout(this.fgDeactivationRemovalTimer),
          this.rmBoundedActivationClasses(),
          this.adapter.removeClass(o),
          this.adapter.computeBoundingRect(),
          this.adapter.addClass(l),
          (this.activationTimer = setTimeout(function () {
            t.activationTimerCallback();
          }, u));
      }),
      (e.prototype.getFgTranslationCoordinates = function () {
        var t = this.activationState,
          r = t.activationEvent,
          i = t.wasActivatedByPointer,
          a;
        i
          ? (a = br(r, this.adapter.getWindowPageOffset(), this.adapter.computeBoundingRect()))
          : (a = { x: this.frame.width / 2, y: this.frame.height / 2 }),
          (a = { x: a.x - this.initialSize / 2, y: a.y - this.initialSize / 2 });
        var s = {
          x: this.frame.width / 2 - this.initialSize / 2,
          y: this.frame.height / 2 - this.initialSize / 2,
        };
        return { startPoint: a, endPoint: s };
      }),
      (e.prototype.runDeactivationUXLogicIfReady = function () {
        var t = this,
          r = e.cssClasses.FG_DEACTIVATION,
          i = this.activationState,
          a = i.hasDeactivationUXRun,
          s = i.isActivated,
          o = a || !s;
        o &&
          this.activationAnimationHasEnded &&
          (this.rmBoundedActivationClasses(),
          this.adapter.addClass(r),
          (this.fgDeactivationRemovalTimer = setTimeout(function () {
            t.adapter.removeClass(r);
          }, En.FG_DEACTIVATION_MS)));
      }),
      (e.prototype.rmBoundedActivationClasses = function () {
        var t = e.cssClasses.FG_ACTIVATION;
        this.adapter.removeClass(t),
          (this.activationAnimationHasEnded = !1),
          this.adapter.computeBoundingRect();
      }),
      (e.prototype.resetActivationState = function () {
        var t = this;
        (this.previousActivationEvent = this.activationState.activationEvent),
          (this.activationState = this.defaultActivationState()),
          setTimeout(function () {
            return (t.previousActivationEvent = void 0);
          }, e.numbers.TAP_DELAY_MS);
      }),
      (e.prototype.deactivateImpl = function () {
        var t = this,
          r = this.activationState;
        if (r.isActivated) {
          var i = Me({}, r);
          r.isProgrammatic
            ? (requestAnimationFrame(function () {
                t.animateDeactivation(i);
              }),
              this.resetActivationState())
            : (this.deregisterDeactivationHandlers(),
              requestAnimationFrame(function () {
                (t.activationState.hasDeactivationUXRun = !0),
                  t.animateDeactivation(i),
                  t.resetActivationState();
              }));
        }
      }),
      (e.prototype.animateDeactivation = function (t) {
        var r = t.wasActivatedByPointer,
          i = t.wasElementMadeActive;
        (r || i) && this.runDeactivationUXLogicIfReady();
      }),
      (e.prototype.layoutInternal = function () {
        var t = this;
        this.frame = this.adapter.computeBoundingRect();
        var r = Math.max(this.frame.height, this.frame.width),
          i = function () {
            var s = Math.sqrt(Math.pow(t.frame.width, 2) + Math.pow(t.frame.height, 2));
            return s + e.numbers.PADDING;
          };
        this.maxRadius = this.adapter.isUnbounded() ? r : i();
        var a = Math.floor(r * e.numbers.INITIAL_ORIGIN_SCALE);
        this.adapter.isUnbounded() && a % 2 !== 0
          ? (this.initialSize = a - 1)
          : (this.initialSize = a),
          (this.fgScale = '' + this.maxRadius / this.initialSize),
          this.updateLayoutCssVars();
      }),
      (e.prototype.updateLayoutCssVars = function () {
        var t = e.strings,
          r = t.VAR_FG_SIZE,
          i = t.VAR_LEFT,
          a = t.VAR_TOP,
          s = t.VAR_FG_SCALE;
        this.adapter.updateCssVariable(r, this.initialSize + 'px'),
          this.adapter.updateCssVariable(s, this.fgScale),
          this.adapter.isUnbounded() &&
            ((this.unboundedCoords = {
              left: Math.round(this.frame.width / 2 - this.initialSize / 2),
              top: Math.round(this.frame.height / 2 - this.initialSize / 2),
            }),
            this.adapter.updateCssVariable(i, this.unboundedCoords.left + 'px'),
            this.adapter.updateCssVariable(a, this.unboundedCoords.top + 'px'));
      }),
      e
    );
  })(Dt);
/**
 * @license
 * Copyright 2018 Google Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */ var Pt = { ICON_BUTTON_ON: 'mdc-icon-button--on', ROOT: 'mdc-icon-button' },
  Xe = {
    ARIA_LABEL: 'aria-label',
    ARIA_PRESSED: 'aria-pressed',
    DATA_ARIA_LABEL_OFF: 'data-aria-label-off',
    DATA_ARIA_LABEL_ON: 'data-aria-label-on',
    CHANGE_EVENT: 'MDCIconButtonToggle:change',
  };
/**
 * @license
 * Copyright 2018 Google Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */ var Ar = (function (n) {
  Rt(e, n);
  function e(t) {
    var r = n.call(this, Me(Me({}, e.defaultAdapter), t)) || this;
    return (r.hasToggledAriaLabel = !1), r;
  }
  return (
    Object.defineProperty(e, 'cssClasses', {
      get: function () {
        return Pt;
      },
      enumerable: !1,
      configurable: !0,
    }),
    Object.defineProperty(e, 'strings', {
      get: function () {
        return Xe;
      },
      enumerable: !1,
      configurable: !0,
    }),
    Object.defineProperty(e, 'defaultAdapter', {
      get: function () {
        return {
          addClass: function () {},
          hasClass: function () {
            return !1;
          },
          notifyChange: function () {},
          removeClass: function () {},
          getAttr: function () {
            return null;
          },
          setAttr: function () {},
        };
      },
      enumerable: !1,
      configurable: !0,
    }),
    (e.prototype.init = function () {
      var t = this.adapter.getAttr(Xe.DATA_ARIA_LABEL_ON),
        r = this.adapter.getAttr(Xe.DATA_ARIA_LABEL_OFF);
      if (t && r) {
        if (this.adapter.getAttr(Xe.ARIA_PRESSED) !== null)
          throw new Error(
            'MDCIconButtonToggleFoundation: Button should not set `aria-pressed` if it has a toggled aria label.'
          );
        this.hasToggledAriaLabel = !0;
      } else this.adapter.setAttr(Xe.ARIA_PRESSED, String(this.isOn()));
    }),
    (e.prototype.handleClick = function () {
      this.toggle(), this.adapter.notifyChange({ isOn: this.isOn() });
    }),
    (e.prototype.isOn = function () {
      return this.adapter.hasClass(Pt.ICON_BUTTON_ON);
    }),
    (e.prototype.toggle = function (t) {
      if (
        (t === void 0 && (t = !this.isOn()),
        t ? this.adapter.addClass(Pt.ICON_BUTTON_ON) : this.adapter.removeClass(Pt.ICON_BUTTON_ON),
        this.hasToggledAriaLabel)
      ) {
        var r = t
          ? this.adapter.getAttr(Xe.DATA_ARIA_LABEL_ON)
          : this.adapter.getAttr(Xe.DATA_ARIA_LABEL_OFF);
        this.adapter.setAttr(Xe.ARIA_LABEL, r || '');
      } else this.adapter.setAttr(Xe.ARIA_PRESSED, '' + t);
    }),
    e
  );
})(Dt);
function x(n) {
  return Object.entries(n)
    .filter(([e, t]) => e !== '' && t)
    .map(([e]) => e)
    .join(' ');
}
function se(n, e, t, r = { bubbles: !0 }, i = !1) {
  if (typeof Event > 'u') throw new Error('Event not defined.');
  if (!n) throw new Error('Tried to dipatch event without element.');
  const a = new CustomEvent(e, Object.assign(Object.assign({}, r), { detail: t }));
  if ((n == null || n.dispatchEvent(a), i && e.startsWith('SMUI'))) {
    const s = new CustomEvent(
      e.replace(/^SMUI/g, () => 'MDC'),
      Object.assign(Object.assign({}, r), { detail: t })
    );
    n == null || n.dispatchEvent(s), s.defaultPrevented && a.preventDefault();
  }
  return a;
}
function Qt(n, e) {
  let t = Object.getOwnPropertyNames(n);
  const r = {};
  for (let i = 0; i < t.length; i++) {
    const a = t[i],
      s = a.indexOf('$');
    (s !== -1 && e.indexOf(a.substring(0, s + 1)) !== -1) || (e.indexOf(a) === -1 && (r[a] = n[a]));
  }
  return r;
}
const An = /^[a-z]+(?::(?:preventDefault|stopPropagation|passive|nonpassive|capture|once|self))+$/,
  Tr = /^[^$]+(?:\$(?:preventDefault|stopPropagation|passive|nonpassive|capture|once|self))+$/;
function ze(n) {
  let e,
    t = [];
  n.$on = (i, a) => {
    let s = i,
      o = () => {};
    return (
      e ? (o = e(s, a)) : t.push([s, a]),
      s.match(An) &&
        console &&
        console.warn(
          'Event modifiers in SMUI now use "$" instead of ":", so that all events can be bound with modifiers. Please update your event binding: ',
          s
        ),
      () => {
        o();
      }
    );
  };
  function r(i) {
    const a = n.$$.callbacks[i.type];
    a && a.slice().forEach((s) => s.call(this, i));
  }
  return (i) => {
    const a = [],
      s = {};
    e = (o, l) => {
      let u = o,
        d = l,
        c = !1;
      const f = u.match(An),
        g = u.match(Tr),
        _ = f || g;
      if (u.match(/^SMUI:\w+:/)) {
        const v = u.split(':');
        let A = '';
        for (let H = 0; H < v.length; H++)
          A +=
            H === v.length - 1
              ? ':' + v[H]
              : v[H].split('-')
                  .map((b) => b.slice(0, 1).toUpperCase() + b.slice(1))
                  .join('');
        console.warn(`The event ${u.split('$')[0]} has been renamed to ${A.split('$')[0]}.`),
          (u = A);
      }
      if (_) {
        const v = u.split(f ? ':' : '$');
        u = v[0];
        const A = v.slice(1).reduce((H, b) => ((H[b] = !0), H), {});
        A.passive && ((c = c || {}), (c.passive = !0)),
          A.nonpassive && ((c = c || {}), (c.passive = !1)),
          A.capture && ((c = c || {}), (c.capture = !0)),
          A.once && ((c = c || {}), (c.once = !0)),
          A.preventDefault && (d = yr(d)),
          A.stopPropagation && (d = Cr(d)),
          A.stopImmediatePropagation && (d = Sr(d)),
          A.self && (d = Or(i, d)),
          A.trusted && (d = Rr(d));
      }
      const E = Tn(i, u, d, c),
        p = () => {
          E();
          const v = a.indexOf(p);
          v > -1 && a.splice(v, 1);
        };
      return a.push(p), u in s || (s[u] = Tn(i, u, r)), p;
    };
    for (let o = 0; o < t.length; o++) e(t[o][0], t[o][1]);
    return {
      destroy: () => {
        for (let o = 0; o < a.length; o++) a[o]();
        for (let o of Object.entries(s)) o[1]();
      },
    };
  };
}
function Tn(n, e, t, r) {
  return n.addEventListener(e, t, r), () => n.removeEventListener(e, t, r);
}
function yr(n) {
  return function (e) {
    return e.preventDefault(), n.call(this, e);
  };
}
function Cr(n) {
  return function (e) {
    return e.stopPropagation(), n.call(this, e);
  };
}
function Sr(n) {
  return function (e) {
    return e.stopImmediatePropagation(), n.call(this, e);
  };
}
function Or(n, e) {
  return function (t) {
    if (t.target === n) return e.call(this, t);
  };
}
function Rr(n) {
  return function (e) {
    if (e.isTrusted) return n.call(this, e);
  };
}
function ft(n, e) {
  let t = Object.getOwnPropertyNames(n);
  const r = {};
  for (let i = 0; i < t.length; i++) {
    const a = t[i];
    a.substring(0, e.length) === e && (r[a.substring(e.length)] = n[a]);
  }
  return r;
}
function De(n, e) {
  let t = [];
  if (e)
    for (let r = 0; r < e.length; r++) {
      const i = e[r],
        a = Array.isArray(i) ? i[0] : i;
      Array.isArray(i) && i.length > 1 ? t.push(a(n, i[1])) : t.push(a(n));
    }
  return {
    update(r) {
      if (((r && r.length) || 0) != t.length)
        throw new Error('You must not change the length of an actions array.');
      if (r)
        for (let i = 0; i < r.length; i++) {
          const a = t[i];
          if (a && a.update) {
            const s = r[i];
            Array.isArray(s) && s.length > 1 ? a.update(s[1]) : a.update();
          }
        }
    },
    destroy() {
      for (let r = 0; r < t.length; r++) {
        const i = t[r];
        i && i.destroy && i.destroy();
      }
    },
  };
}
/**
 * @license
 * Copyright 2020 Google Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */ var q = {
    UNKNOWN: 'Unknown',
    BACKSPACE: 'Backspace',
    ENTER: 'Enter',
    SPACEBAR: 'Spacebar',
    PAGE_UP: 'PageUp',
    PAGE_DOWN: 'PageDown',
    END: 'End',
    HOME: 'Home',
    ARROW_LEFT: 'ArrowLeft',
    ARROW_UP: 'ArrowUp',
    ARROW_RIGHT: 'ArrowRight',
    ARROW_DOWN: 'ArrowDown',
    DELETE: 'Delete',
    ESCAPE: 'Escape',
    TAB: 'Tab',
  },
  Se = new Set();
Se.add(q.BACKSPACE);
Se.add(q.ENTER);
Se.add(q.SPACEBAR);
Se.add(q.PAGE_UP);
Se.add(q.PAGE_DOWN);
Se.add(q.END);
Se.add(q.HOME);
Se.add(q.ARROW_LEFT);
Se.add(q.ARROW_UP);
Se.add(q.ARROW_RIGHT);
Se.add(q.ARROW_DOWN);
Se.add(q.DELETE);
Se.add(q.ESCAPE);
Se.add(q.TAB);
var He = {
    BACKSPACE: 8,
    ENTER: 13,
    SPACEBAR: 32,
    PAGE_UP: 33,
    PAGE_DOWN: 34,
    END: 35,
    HOME: 36,
    ARROW_LEFT: 37,
    ARROW_UP: 38,
    ARROW_RIGHT: 39,
    ARROW_DOWN: 40,
    DELETE: 46,
    ESCAPE: 27,
    TAB: 9,
  },
  Oe = new Map();
Oe.set(He.BACKSPACE, q.BACKSPACE);
Oe.set(He.ENTER, q.ENTER);
Oe.set(He.SPACEBAR, q.SPACEBAR);
Oe.set(He.PAGE_UP, q.PAGE_UP);
Oe.set(He.PAGE_DOWN, q.PAGE_DOWN);
Oe.set(He.END, q.END);
Oe.set(He.HOME, q.HOME);
Oe.set(He.ARROW_LEFT, q.ARROW_LEFT);
Oe.set(He.ARROW_UP, q.ARROW_UP);
Oe.set(He.ARROW_RIGHT, q.ARROW_RIGHT);
Oe.set(He.ARROW_DOWN, q.ARROW_DOWN);
Oe.set(He.DELETE, q.DELETE);
Oe.set(He.ESCAPE, q.ESCAPE);
Oe.set(He.TAB, q.TAB);
var nt = new Set();
nt.add(q.PAGE_UP);
nt.add(q.PAGE_DOWN);
nt.add(q.END);
nt.add(q.HOME);
nt.add(q.ARROW_LEFT);
nt.add(q.ARROW_UP);
nt.add(q.ARROW_RIGHT);
nt.add(q.ARROW_DOWN);
function Dr(n) {
  var e = n.key;
  if (Se.has(e)) return e;
  var t = Oe.get(n.keyCode);
  return t || q.UNKNOWN;
}
const { applyPassive: Bt } = hr,
  { matches: wr } = zn;
function on(
  n,
  {
    ripple: e = !0,
    surface: t = !1,
    unbounded: r = !1,
    disabled: i = !1,
    color: a,
    active: s,
    rippleElement: o,
    eventTarget: l,
    activeTarget: u,
    addClass: d = (_) => n.classList.add(_),
    removeClass: c = (_) => n.classList.remove(_),
    addStyle: f = (_, E) => n.style.setProperty(_, E),
    initPromise: g = Promise.resolve(),
  } = {}
) {
  let _,
    E = ye('SMUI:addLayoutListener'),
    p,
    v = s,
    A = l,
    H = u;
  function b() {
    t
      ? (d('mdc-ripple-surface'),
        a === 'primary'
          ? (d('smui-ripple-surface--primary'), c('smui-ripple-surface--secondary'))
          : a === 'secondary'
          ? (c('smui-ripple-surface--primary'), d('smui-ripple-surface--secondary'))
          : (c('smui-ripple-surface--primary'), c('smui-ripple-surface--secondary')))
      : (c('mdc-ripple-surface'),
        c('smui-ripple-surface--primary'),
        c('smui-ripple-surface--secondary')),
      _ && v !== s && ((v = s), s ? _.activate() : s === !1 && _.deactivate()),
      e && !_
        ? ((_ = new vr({
            addClass: d,
            browserSupportsCssVars: () => Er(window),
            computeBoundingRect: () => (o || n).getBoundingClientRect(),
            containsEventTarget: (k) => n.contains(k),
            deregisterDocumentInteractionHandler: (k, S) =>
              document.documentElement.removeEventListener(k, S, Bt()),
            deregisterInteractionHandler: (k, S) => (l || n).removeEventListener(k, S, Bt()),
            deregisterResizeHandler: (k) => window.removeEventListener('resize', k),
            getWindowPageOffset: () => ({ x: window.pageXOffset, y: window.pageYOffset }),
            isSurfaceActive: () => s ?? wr(u || n, ':active'),
            isSurfaceDisabled: () => !!i,
            isUnbounded: () => !!r,
            registerDocumentInteractionHandler: (k, S) =>
              document.documentElement.addEventListener(k, S, Bt()),
            registerInteractionHandler: (k, S) => (l || n).addEventListener(k, S, Bt()),
            registerResizeHandler: (k) => window.addEventListener('resize', k),
            removeClass: c,
            updateCssVariable: f,
          })),
          g.then(() => {
            _ && (_.init(), _.setUnbounded(r));
          }))
        : _ &&
          !e &&
          g.then(() => {
            _ && (_.destroy(), (_ = void 0));
          }),
      _ &&
        (A !== l || H !== u) &&
        ((A = l),
        (H = u),
        _.destroy(),
        requestAnimationFrame(() => {
          _ && (_.init(), _.setUnbounded(r));
        })),
      !e && r && d('mdc-ripple-upgraded--unbounded');
  }
  b(), E && (p = E(C));
  function C() {
    _ && _.layout();
  }
  return {
    update(k) {
      ({
        ripple: e,
        surface: t,
        unbounded: r,
        disabled: i,
        color: a,
        active: s,
        rippleElement: o,
        eventTarget: l,
        activeTarget: u,
        addClass: d,
        removeClass: c,
        addStyle: f,
        initPromise: g,
      } = Object.assign(
        {
          ripple: !0,
          surface: !1,
          unbounded: !1,
          disabled: !1,
          color: void 0,
          active: void 0,
          rippleElement: void 0,
          eventTarget: void 0,
          activeTarget: void 0,
          addClass: (S) => n.classList.add(S),
          removeClass: (S) => n.classList.remove(S),
          addStyle: (S, W) => n.style.setProperty(S, W),
          initPromise: Promise.resolve(),
        },
        k
      )),
        b();
    },
    destroy() {
      _ &&
        (_.destroy(),
        (_ = void 0),
        c('mdc-ripple-surface'),
        c('smui-ripple-surface--primary'),
        c('smui-ripple-surface--secondary')),
        p && p();
    },
  };
}
function Ir(n) {
  let e = n[1],
    t,
    r,
    i = n[1] && sn(n);
  return {
    c() {
      i && i.c(), (t = Ve());
    },
    m(a, s) {
      i && i.m(a, s), I(a, t, s), (r = !0);
    },
    p(a, s) {
      a[1]
        ? e
          ? _e(e, a[1])
            ? (i.d(1), (i = sn(a)), (e = a[1]), i.c(), i.m(t.parentNode, t))
            : i.p(a, s)
          : ((i = sn(a)), (e = a[1]), i.c(), i.m(t.parentNode, t))
        : e && (i.d(1), (i = null), (e = a[1]));
    },
    i(a) {
      r || (w(i, a), (r = !0));
    },
    o(a) {
      L(i, a), (r = !1);
    },
    d(a) {
      a && D(t), i && i.d(a);
    },
  };
}
function Hr(n) {
  let e = n[1],
    t,
    r = n[1] && ln(n);
  return {
    c() {
      r && r.c(), (t = Ve());
    },
    m(i, a) {
      r && r.m(i, a), I(i, t, a);
    },
    p(i, a) {
      i[1]
        ? e
          ? _e(e, i[1])
            ? (r.d(1), (r = ln(i)), (e = i[1]), r.c(), r.m(t.parentNode, t))
            : r.p(i, a)
          : ((r = ln(i)), (e = i[1]), r.c(), r.m(t.parentNode, t))
        : e && (r.d(1), (r = null), (e = i[1]));
    },
    i: Ne,
    o: Ne,
    d(i) {
      i && D(t), r && r.d(i);
    },
  };
}
function Lr(n) {
  let e, t, r, i, a;
  const s = n[8].default,
    o = Ee(s, n, n[7], null);
  let l = [n[5]],
    u = {};
  for (let d = 0; d < l.length; d += 1) u = F(u, l[d]);
  return {
    c() {
      (e = Vt('svg')), o && o.c(), Kt(e, u);
    },
    m(d, c) {
      I(d, e, c),
        o && o.m(e, null),
        n[9](e),
        (r = !0),
        i || ((a = [ee((t = De.call(null, e, n[0]))), ee(n[4].call(null, e))]), (i = !0));
    },
    p(d, c) {
      o && o.p && (!r || c & 128) && ve(o, s, d, d[7], r ? be(s, d[7], c, null) : Ae(d[7]), null),
        Kt(e, (u = le(l, [c & 32 && d[5]]))),
        t && me(t.update) && c & 1 && t.update.call(null, d[0]);
    },
    i(d) {
      r || (w(o, d), (r = !0));
    },
    o(d) {
      L(o, d), (r = !1);
    },
    d(d) {
      d && D(e), o && o.d(d), n[9](null), (i = !1), he(a);
    },
  };
}
function sn(n) {
  let e, t, r, i, a;
  const s = n[8].default,
    o = Ee(s, n, n[7], null);
  let l = [n[5]],
    u = {};
  for (let d = 0; d < l.length; d += 1) u = F(u, l[d]);
  return {
    c() {
      (e = J(n[1])), o && o.c(), qt(n[1])(e, u);
    },
    m(d, c) {
      I(d, e, c),
        o && o.m(e, null),
        n[11](e),
        (r = !0),
        i || ((a = [ee((t = De.call(null, e, n[0]))), ee(n[4].call(null, e))]), (i = !0));
    },
    p(d, c) {
      o && o.p && (!r || c & 128) && ve(o, s, d, d[7], r ? be(s, d[7], c, null) : Ae(d[7]), null),
        qt(d[1])(e, (u = le(l, [c & 32 && d[5]]))),
        t && me(t.update) && c & 1 && t.update.call(null, d[0]);
    },
    i(d) {
      r || (w(o, d), (r = !0));
    },
    o(d) {
      L(o, d), (r = !1);
    },
    d(d) {
      d && D(e), o && o.d(d), n[11](null), (i = !1), he(a);
    },
  };
}
function ln(n) {
  let e,
    t,
    r,
    i,
    a = [n[5]],
    s = {};
  for (let o = 0; o < a.length; o += 1) s = F(s, a[o]);
  return {
    c() {
      (e = J(n[1])), qt(n[1])(e, s);
    },
    m(o, l) {
      I(o, e, l),
        n[10](e),
        r || ((i = [ee((t = De.call(null, e, n[0]))), ee(n[4].call(null, e))]), (r = !0));
    },
    p(o, l) {
      qt(o[1])(e, (s = le(a, [l & 32 && o[5]]))),
        t && me(t.update) && l & 1 && t.update.call(null, o[0]);
    },
    d(o) {
      o && D(e), n[10](null), (r = !1), he(i);
    },
  };
}
function kr(n) {
  let e, t, r, i;
  const a = [Lr, Hr, Ir],
    s = [];
  function o(l, u) {
    return l[1] === 'svg' ? 0 : l[3] ? 1 : 2;
  }
  return (
    (e = o(n)),
    (t = s[e] = a[e](n)),
    {
      c() {
        t.c(), (r = Ve());
      },
      m(l, u) {
        s[e].m(l, u), I(l, r, u), (i = !0);
      },
      p(l, [u]) {
        let d = e;
        (e = o(l)),
          e === d
            ? s[e].p(l, u)
            : (et(),
              L(s[d], 1, 1, () => {
                s[d] = null;
              }),
              tt(),
              (t = s[e]),
              t ? t.p(l, u) : ((t = s[e] = a[e](l)), t.c()),
              w(t, 1),
              t.m(r.parentNode, r));
      },
      i(l) {
        i || (w(t), (i = !0));
      },
      o(l) {
        L(t), (i = !1);
      },
      d(l) {
        l && D(r), s[e].d(l);
      },
    }
  );
}
function Nr(n, e, t) {
  let r;
  const i = ['use', 'tag', 'getElement'];
  let a = re(e, i),
    { $$slots: s = {}, $$scope: o } = e,
    { use: l = [] } = e,
    { tag: u } = e;
  const d = ze(Ce());
  let c;
  function f() {
    return c;
  }
  function g(p) {
    fe[p ? 'unshift' : 'push'](() => {
      (c = p), t(2, c);
    });
  }
  function _(p) {
    fe[p ? 'unshift' : 'push'](() => {
      (c = p), t(2, c);
    });
  }
  function E(p) {
    fe[p ? 'unshift' : 'push'](() => {
      (c = p), t(2, c);
    });
  }
  return (
    (n.$$set = (p) => {
      (e = F(F({}, e), Ge(p))),
        t(5, (a = re(e, i))),
        'use' in p && t(0, (l = p.use)),
        'tag' in p && t(1, (u = p.tag)),
        '$$scope' in p && t(7, (o = p.$$scope));
    }),
    (n.$$.update = () => {
      n.$$.dirty & 2 &&
        t(
          3,
          (r =
            [
              'area',
              'base',
              'br',
              'col',
              'embed',
              'hr',
              'img',
              'input',
              'link',
              'meta',
              'param',
              'source',
              'track',
              'wbr',
            ].indexOf(u) > -1)
        );
    }),
    [l, u, c, r, d, a, f, o, s, g, _, E]
  );
}
class Jt extends Ie {
  constructor(e) {
    super(), we(this, e, Nr, kr, _e, { use: 0, tag: 1, getElement: 6 });
  }
  get getElement() {
    return this.$$.ctx[6];
  }
}
const ct = [];
function Ct(n, e = Ne) {
  let t;
  const r = new Set();
  function i(o) {
    if (_e(n, o) && ((n = o), t)) {
      const l = !ct.length;
      for (const u of r) u[1](), ct.push(u, n);
      if (l) {
        for (let u = 0; u < ct.length; u += 2) ct[u][0](ct[u + 1]);
        ct.length = 0;
      }
    }
  }
  function a(o) {
    i(o(n));
  }
  function s(o, l = Ne) {
    const u = [o, l];
    return (
      r.add(u),
      r.size === 1 && (t = e(i, a) || Ne),
      o(n),
      () => {
        r.delete(u), r.size === 0 && t && (t(), (t = null));
      }
    );
  }
  return { set: i, update: a, subscribe: s };
}
function yn(n) {
  let e;
  return {
    c() {
      (e = J('div')), Q(e, 'class', 'mdc-icon-button__touch');
    },
    m(t, r) {
      I(t, e, r);
    },
    d(t) {
      t && D(e);
    },
  };
}
function Mr(n) {
  let e, t, r, i;
  const a = n[33].default,
    s = Ee(a, n, n[37], null);
  let o = n[8] && yn();
  return {
    c() {
      (e = J('div')),
        (t = Y()),
        s && s.c(),
        o && o.c(),
        (r = Ve()),
        Q(e, 'class', 'mdc-icon-button__ripple');
    },
    m(l, u) {
      I(l, e, u), I(l, t, u), s && s.m(l, u), o && o.m(l, u), I(l, r, u), (i = !0);
    },
    p(l, u) {
      s &&
        s.p &&
        (!i || u[1] & 64) &&
        ve(s, a, l, l[37], i ? be(a, l[37], u, null) : Ae(l[37]), null),
        l[8] ? o || ((o = yn()), o.c(), o.m(r.parentNode, r)) : o && (o.d(1), (o = null));
    },
    i(l) {
      i || (w(s, l), (i = !0));
    },
    o(l) {
      L(s, l), (i = !1);
    },
    d(l) {
      l && (D(e), D(t), D(r)), s && s.d(l), o && o.d(l);
    },
  };
}
function Pr(n) {
  let e, t, r;
  const i = [
    { tag: n[14] },
    {
      use: [
        [
          on,
          {
            ripple: n[4],
            unbounded: !0,
            color: n[5],
            disabled: !!n[29].disabled,
            addClass: n[26],
            removeClass: n[27],
            addStyle: n[28],
          },
        ],
        n[22],
        ...n[1],
      ],
    },
    {
      class: x({
        [n[2]]: !0,
        'mdc-icon-button': !0,
        'mdc-icon-button--on': !n[23](n[0]) && n[0],
        'mdc-icon-button--touch': n[8],
        'mdc-icon-button--display-flex': n[9],
        'smui-icon-button--size-button': n[10] === 'button',
        'smui-icon-button--size-mini': n[10] === 'mini',
        'mdc-icon-button--reduced-size': n[10] === 'mini' || n[10] === 'button',
        'mdc-card__action': n[24] === 'card:action',
        'mdc-card__action--icon': n[24] === 'card:action',
        'mdc-top-app-bar__navigation-icon': n[24] === 'top-app-bar:navigation',
        'mdc-top-app-bar__action-item': n[24] === 'top-app-bar:action',
        'mdc-snackbar__dismiss': n[24] === 'snackbar:actions',
        'mdc-data-table__pagination-button': n[24] === 'data-table:pagination',
        'mdc-data-table__sort-icon-button': n[24] === 'data-table:sortable-header-cell',
        'mdc-dialog__close':
          (n[24] === 'dialog:header' || n[24] === 'dialog:sheet') && n[12] === 'close',
        ...n[18],
      }),
    },
    { style: Object.entries(n[19]).map(un).concat([n[3]]).join(' ') },
    { 'aria-pressed': n[23](n[0]) ? null : n[0] ? 'true' : 'false' },
    { 'aria-label': n[0] ? n[6] : n[7] },
    { 'data-aria-label-on': n[6] },
    { 'data-aria-label-off': n[7] },
    { 'aria-describedby': n[25] },
    { href: n[11] },
    n[21],
    n[20],
    n[29],
  ];
  var a = n[13];
  function s(o, l) {
    let u = { $$slots: { default: [Mr] }, $$scope: { ctx: o } };
    for (let d = 0; d < i.length; d += 1) u = F(u, i[d]);
    return (
      l !== void 0 &&
        l[0] & 1073504255 &&
        (u = F(
          u,
          le(i, [
            l[0] & 16384 && { tag: o[14] },
            l[0] & 1010827314 && {
              use: [
                [
                  on,
                  {
                    ripple: o[4],
                    unbounded: !0,
                    color: o[5],
                    disabled: !!o[29].disabled,
                    addClass: o[26],
                    removeClass: o[27],
                    addStyle: o[28],
                  },
                ],
                o[22],
                ...o[1],
              ],
            },
            l[0] & 25433861 && {
              class: x({
                [o[2]]: !0,
                'mdc-icon-button': !0,
                'mdc-icon-button--on': !o[23](o[0]) && o[0],
                'mdc-icon-button--touch': o[8],
                'mdc-icon-button--display-flex': o[9],
                'smui-icon-button--size-button': o[10] === 'button',
                'smui-icon-button--size-mini': o[10] === 'mini',
                'mdc-icon-button--reduced-size': o[10] === 'mini' || o[10] === 'button',
                'mdc-card__action': o[24] === 'card:action',
                'mdc-card__action--icon': o[24] === 'card:action',
                'mdc-top-app-bar__navigation-icon': o[24] === 'top-app-bar:navigation',
                'mdc-top-app-bar__action-item': o[24] === 'top-app-bar:action',
                'mdc-snackbar__dismiss': o[24] === 'snackbar:actions',
                'mdc-data-table__pagination-button': o[24] === 'data-table:pagination',
                'mdc-data-table__sort-icon-button': o[24] === 'data-table:sortable-header-cell',
                'mdc-dialog__close':
                  (o[24] === 'dialog:header' || o[24] === 'dialog:sheet') && o[12] === 'close',
                ...o[18],
              }),
            },
            l[0] & 524296 && { style: Object.entries(o[19]).map(un).concat([o[3]]).join(' ') },
            l[0] & 8388609 && { 'aria-pressed': o[23](o[0]) ? null : o[0] ? 'true' : 'false' },
            l[0] & 193 && { 'aria-label': o[0] ? o[6] : o[7] },
            l[0] & 64 && { 'data-aria-label-on': o[6] },
            l[0] & 128 && { 'data-aria-label-off': o[7] },
            l[0] & 33554432 && { 'aria-describedby': o[25] },
            l[0] & 2048 && { href: o[11] },
            l[0] & 2097152 && je(o[21]),
            l[0] & 1048576 && je(o[20]),
            l[0] & 536870912 && je(o[29]),
          ])
        )),
      { props: u }
    );
  }
  return (
    a && ((e = Xt(a, s(n))), n[34](e), e.$on('click', n[35]), e.$on('click', n[36])),
    {
      c() {
        e && K(e.$$.fragment), (t = Ve());
      },
      m(o, l) {
        e && z(e, o, l), I(o, t, l), (r = !0);
      },
      p(o, l) {
        if (l[0] & 8192 && a !== (a = o[13])) {
          if (e) {
            et();
            const u = e;
            L(u.$$.fragment, 1, 0, () => {
              j(u, 1);
            }),
              tt();
          }
          a
            ? ((e = Xt(a, s(o, l))),
              o[34](e),
              e.$on('click', o[35]),
              e.$on('click', o[36]),
              K(e.$$.fragment),
              w(e.$$.fragment, 1),
              z(e, t.parentNode, t))
            : (e = null);
        } else if (a) {
          const u =
            l[0] & 1073504255
              ? le(i, [
                  l[0] & 16384 && { tag: o[14] },
                  l[0] & 1010827314 && {
                    use: [
                      [
                        on,
                        {
                          ripple: o[4],
                          unbounded: !0,
                          color: o[5],
                          disabled: !!o[29].disabled,
                          addClass: o[26],
                          removeClass: o[27],
                          addStyle: o[28],
                        },
                      ],
                      o[22],
                      ...o[1],
                    ],
                  },
                  l[0] & 25433861 && {
                    class: x({
                      [o[2]]: !0,
                      'mdc-icon-button': !0,
                      'mdc-icon-button--on': !o[23](o[0]) && o[0],
                      'mdc-icon-button--touch': o[8],
                      'mdc-icon-button--display-flex': o[9],
                      'smui-icon-button--size-button': o[10] === 'button',
                      'smui-icon-button--size-mini': o[10] === 'mini',
                      'mdc-icon-button--reduced-size': o[10] === 'mini' || o[10] === 'button',
                      'mdc-card__action': o[24] === 'card:action',
                      'mdc-card__action--icon': o[24] === 'card:action',
                      'mdc-top-app-bar__navigation-icon': o[24] === 'top-app-bar:navigation',
                      'mdc-top-app-bar__action-item': o[24] === 'top-app-bar:action',
                      'mdc-snackbar__dismiss': o[24] === 'snackbar:actions',
                      'mdc-data-table__pagination-button': o[24] === 'data-table:pagination',
                      'mdc-data-table__sort-icon-button':
                        o[24] === 'data-table:sortable-header-cell',
                      'mdc-dialog__close':
                        (o[24] === 'dialog:header' || o[24] === 'dialog:sheet') &&
                        o[12] === 'close',
                      ...o[18],
                    }),
                  },
                  l[0] & 524296 && {
                    style: Object.entries(o[19]).map(un).concat([o[3]]).join(' '),
                  },
                  l[0] & 8388609 && {
                    'aria-pressed': o[23](o[0]) ? null : o[0] ? 'true' : 'false',
                  },
                  l[0] & 193 && { 'aria-label': o[0] ? o[6] : o[7] },
                  l[0] & 64 && { 'data-aria-label-on': o[6] },
                  l[0] & 128 && { 'data-aria-label-off': o[7] },
                  l[0] & 33554432 && { 'aria-describedby': o[25] },
                  l[0] & 2048 && { href: o[11] },
                  l[0] & 2097152 && je(o[21]),
                  l[0] & 1048576 && je(o[20]),
                  l[0] & 536870912 && je(o[29]),
                ])
              : {};
          (l[0] & 256) | (l[1] & 64) && (u.$$scope = { dirty: l, ctx: o }), e.$set(u);
        }
      },
      i(o) {
        r || (e && w(e.$$.fragment, o), (r = !0));
      },
      o(o) {
        e && L(e.$$.fragment, o), (r = !1);
      },
      d(o) {
        o && D(t), n[34](null), e && j(e, o);
      },
    }
  );
}
const un = ([n, e]) => `${n}: ${e};`;
function Br(n, e, t) {
  let r;
  const i = [
    'use',
    'class',
    'style',
    'ripple',
    'color',
    'toggle',
    'pressed',
    'ariaLabelOn',
    'ariaLabelOff',
    'touch',
    'displayFlex',
    'size',
    'href',
    'action',
    'component',
    'tag',
    'getElement',
  ];
  let a = re(e, i),
    { $$slots: s = {}, $$scope: o } = e;
  const l = ze(Ce());
  let u = () => {};
  function d(R) {
    return R === u;
  }
  let { use: c = [] } = e,
    { class: f = '' } = e,
    { style: g = '' } = e,
    { ripple: _ = !0 } = e,
    { color: E = void 0 } = e,
    { toggle: p = !1 } = e,
    { pressed: v = u } = e,
    { ariaLabelOn: A = void 0 } = e,
    { ariaLabelOff: H = void 0 } = e,
    { touch: b = !1 } = e,
    { displayFlex: C = !0 } = e,
    { size: k = 'normal' } = e,
    { href: S = void 0 } = e,
    { action: W = void 0 } = e,
    G,
    T,
    O = {},
    y = {},
    N = {},
    Z = ye('SMUI:icon-button:context'),
    Le = ye('SMUI:icon-button:aria-describedby'),
    { component: We = Jt } = e,
    { tag: Pe = We === Jt ? (S == null ? 'button' : 'a') : void 0 } = e,
    ae = a.disabled;
  de('SMUI:icon:context', 'icon-button');
  let M = null;
  xt(() => {
    T && T.destroy();
  });
  function ge(R) {
    return R in O ? O[R] : Fe().classList.contains(R);
  }
  function qe(R) {
    O[R] || t(18, (O[R] = !0), O);
  }
  function Je(R) {
    (!(R in O) || O[R]) && t(18, (O[R] = !1), O);
  }
  function _t(R, pe) {
    y[R] != pe && (pe === '' || pe == null ? (delete y[R], t(19, y)) : t(19, (y[R] = pe), y));
  }
  function gt(R) {
    var pe;
    return R in N ? ((pe = N[R]) !== null && pe !== void 0 ? pe : null) : Fe().getAttribute(R);
  }
  function Et(R, pe) {
    N[R] !== pe && t(20, (N[R] = pe), N);
  }
  function bt(R) {
    t(0, (v = R.isOn));
  }
  function Fe() {
    return G.getElement();
  }
  function rt(R) {
    fe[R ? 'unshift' : 'push'](() => {
      (G = R), t(16, G);
    });
  }
  const vt = () => T && T.handleClick(),
    lt = () => Z === 'top-app-bar:navigation' && se(Fe(), 'SMUITopAppBarIconButton:nav');
  return (
    (n.$$set = (R) => {
      (e = F(F({}, e), Ge(R))),
        t(29, (a = re(e, i))),
        'use' in R && t(1, (c = R.use)),
        'class' in R && t(2, (f = R.class)),
        'style' in R && t(3, (g = R.style)),
        'ripple' in R && t(4, (_ = R.ripple)),
        'color' in R && t(5, (E = R.color)),
        'toggle' in R && t(30, (p = R.toggle)),
        'pressed' in R && t(0, (v = R.pressed)),
        'ariaLabelOn' in R && t(6, (A = R.ariaLabelOn)),
        'ariaLabelOff' in R && t(7, (H = R.ariaLabelOff)),
        'touch' in R && t(8, (b = R.touch)),
        'displayFlex' in R && t(9, (C = R.displayFlex)),
        'size' in R && t(10, (k = R.size)),
        'href' in R && t(11, (S = R.href)),
        'action' in R && t(12, (W = R.action)),
        'component' in R && t(13, (We = R.component)),
        'tag' in R && t(14, (Pe = R.tag)),
        '$$scope' in R && t(37, (o = R.$$scope));
    }),
    (n.$$.update = () => {
      if (
        (n.$$.dirty[0] & 4096 &&
          t(
            21,
            (r = (() => {
              if (Z === 'data-table:pagination')
                switch (W) {
                  case 'first-page':
                    return { 'data-first-page': 'true' };
                  case 'prev-page':
                    return { 'data-prev-page': 'true' };
                  case 'next-page':
                    return { 'data-next-page': 'true' };
                  case 'last-page':
                    return { 'data-last-page': 'true' };
                  default:
                    return { 'data-action': 'true' };
                }
              else
                return Z === 'dialog:header' || Z === 'dialog:sheet'
                  ? { 'data-mdc-dialog-action': W }
                  : { action: W };
            })())
          ),
        ae !== a.disabled)
      ) {
        if (G) {
          const R = Fe();
          'blur' in R && R.blur();
        }
        t(31, (ae = a.disabled));
      }
      (n.$$.dirty[0] & 1073938432) | (n.$$.dirty[1] & 2) &&
        G &&
        Fe() &&
        p !== M &&
        (p && !T
          ? (t(
              17,
              (T = new Ar({
                addClass: qe,
                hasClass: ge,
                notifyChange: (R) => {
                  bt(R), se(Fe(), 'SMUIIconButtonToggle:change', R, void 0, !0);
                },
                removeClass: Je,
                getAttr: gt,
                setAttr: Et,
              }))
            ),
            T.init())
          : !p && T && (T.destroy(), t(17, (T = void 0)), t(18, (O = {})), t(20, (N = {}))),
        t(32, (M = p))),
        n.$$.dirty[0] & 131073 && T && !d(v) && T.isOn() !== v && T.toggle(v);
    }),
    [
      v,
      c,
      f,
      g,
      _,
      E,
      A,
      H,
      b,
      C,
      k,
      S,
      W,
      We,
      Pe,
      Fe,
      G,
      T,
      O,
      y,
      N,
      r,
      l,
      d,
      Z,
      Le,
      qe,
      Je,
      _t,
      a,
      p,
      ae,
      M,
      s,
      rt,
      vt,
      lt,
      o,
    ]
  );
}
class mt extends Ie {
  constructor(e) {
    super(),
      we(
        this,
        e,
        Br,
        Pr,
        _e,
        {
          use: 1,
          class: 2,
          style: 3,
          ripple: 4,
          color: 5,
          toggle: 30,
          pressed: 0,
          ariaLabelOn: 6,
          ariaLabelOff: 7,
          touch: 8,
          displayFlex: 9,
          size: 10,
          href: 11,
          action: 12,
          component: 13,
          tag: 14,
          getElement: 15,
        },
        null,
        [-1, -1]
      );
  }
  get getElement() {
    return this.$$.ctx[15];
  }
}
/**
 * @license
 * Copyright 2020 Google Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */ var Re;
(function (n) {
  (n.RICH = 'mdc-tooltip--rich'),
    (n.SHOWN = 'mdc-tooltip--shown'),
    (n.SHOWING = 'mdc-tooltip--showing'),
    (n.SHOWING_TRANSITION = 'mdc-tooltip--showing-transition'),
    (n.HIDE = 'mdc-tooltip--hide'),
    (n.HIDE_TRANSITION = 'mdc-tooltip--hide-transition'),
    (n.MULTILINE_TOOLTIP = 'mdc-tooltip--multiline'),
    (n.SURFACE = 'mdc-tooltip__surface'),
    (n.SURFACE_ANIMATION = 'mdc-tooltip__surface-animation'),
    (n.TOOLTIP_CARET_TOP = 'mdc-tooltip__caret-surface-top'),
    (n.TOOLTIP_CARET_BOTTOM = 'mdc-tooltip__caret-surface-bottom');
})(Re || (Re = {}));
var Te = {
    BOUNDED_ANCHOR_GAP: 4,
    UNBOUNDED_ANCHOR_GAP: 8,
    MIN_VIEWPORT_TOOLTIP_THRESHOLD: 8,
    HIDE_DELAY_MS: 600,
    SHOW_DELAY_MS: 500,
    MIN_HEIGHT: 24,
    MAX_WIDTH: 200,
    CARET_INDENTATION: 24,
    ANIMATION_SCALE: 0.8,
  },
  Ut = {
    ARIA_EXPANDED: 'aria-expanded',
    ARIA_HASPOPUP: 'aria-haspopup',
    PERSISTENT: 'data-mdc-tooltip-persistent',
    SCROLLABLE_ANCESTOR: 'tooltip-scrollable-ancestor',
    HAS_CARET: 'data-mdc-tooltip-has-caret',
  },
  st;
(function (n) {
  (n[(n.DETECTED = 0)] = 'DETECTED'),
    (n[(n.START = 1)] = 'START'),
    (n[(n.CENTER = 2)] = 'CENTER'),
    (n[(n.END = 3)] = 'END');
})(st || (st = {}));
var pt;
(function (n) {
  (n[(n.DETECTED = 0)] = 'DETECTED'), (n[(n.ABOVE = 1)] = 'ABOVE'), (n[(n.BELOW = 2)] = 'BELOW');
})(pt || (pt = {}));
var Yt;
(function (n) {
  (n[(n.BOUNDED = 0)] = 'BOUNDED'), (n[(n.UNBOUNDED = 1)] = 'UNBOUNDED');
})(Yt || (Yt = {}));
var U = { LEFT: 'left', RIGHT: 'right', CENTER: 'center', TOP: 'top', BOTTOM: 'bottom' },
  V;
(function (n) {
  (n[(n.DETECTED = 0)] = 'DETECTED'),
    (n[(n.ABOVE_START = 1)] = 'ABOVE_START'),
    (n[(n.ABOVE_CENTER = 2)] = 'ABOVE_CENTER'),
    (n[(n.ABOVE_END = 3)] = 'ABOVE_END'),
    (n[(n.TOP_SIDE_START = 4)] = 'TOP_SIDE_START'),
    (n[(n.CENTER_SIDE_START = 5)] = 'CENTER_SIDE_START'),
    (n[(n.BOTTOM_SIDE_START = 6)] = 'BOTTOM_SIDE_START'),
    (n[(n.TOP_SIDE_END = 7)] = 'TOP_SIDE_END'),
    (n[(n.CENTER_SIDE_END = 8)] = 'CENTER_SIDE_END'),
    (n[(n.BOTTOM_SIDE_END = 9)] = 'BOTTOM_SIDE_END'),
    (n[(n.BELOW_START = 10)] = 'BELOW_START'),
    (n[(n.BELOW_CENTER = 11)] = 'BELOW_CENTER'),
    (n[(n.BELOW_END = 12)] = 'BELOW_END');
})(V || (V = {}));
var ue;
(function (n) {
  (n[(n.ABOVE = 1)] = 'ABOVE'),
    (n[(n.BELOW = 2)] = 'BELOW'),
    (n[(n.SIDE_TOP = 3)] = 'SIDE_TOP'),
    (n[(n.SIDE_CENTER = 4)] = 'SIDE_CENTER'),
    (n[(n.SIDE_BOTTOM = 5)] = 'SIDE_BOTTOM');
})(ue || (ue = {}));
var X;
(function (n) {
  (n[(n.START = 1)] = 'START'),
    (n[(n.CENTER = 2)] = 'CENTER'),
    (n[(n.END = 3)] = 'END'),
    (n[(n.SIDE_START = 4)] = 'SIDE_START'),
    (n[(n.SIDE_END = 5)] = 'SIDE_END');
})(X || (X = {}));
/**
 * @license
 * Copyright 2020 Google Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */ var Ur = (function () {
  function n() {
    this.rafIDs = new Map();
  }
  return (
    (n.prototype.request = function (e, t) {
      var r = this;
      this.cancel(e);
      var i = requestAnimationFrame(function (a) {
        r.rafIDs.delete(e), t(a);
      });
      this.rafIDs.set(e, i);
    }),
    (n.prototype.cancel = function (e) {
      var t = this.rafIDs.get(e);
      t && (cancelAnimationFrame(t), this.rafIDs.delete(e));
    }),
    (n.prototype.cancelAll = function () {
      var e = this;
      this.rafIDs.forEach(function (t, r) {
        e.cancel(r);
      });
    }),
    (n.prototype.getQueue = function () {
      var e = [];
      return (
        this.rafIDs.forEach(function (t, r) {
          e.push(r);
        }),
        e
      );
    }),
    n
  );
})();
/**
 * @license
 * Copyright 2016 Google Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */ var Cn = {
  animation: { prefixed: '-webkit-animation', standard: 'animation' },
  transform: { prefixed: '-webkit-transform', standard: 'transform' },
  transition: { prefixed: '-webkit-transition', standard: 'transition' },
};
function Wr(n) {
  return !!n.document && typeof n.document.createElement == 'function';
}
function Sn(n, e) {
  if (Wr(n) && e in Cn) {
    var t = n.document.createElement('div'),
      r = Cn[e],
      i = r.standard,
      a = r.prefixed,
      s = i in t.style;
    return s ? i : a;
  }
  return e;
}
/**
 * @license
 * Copyright 2020 Google Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */ var Fr = Re.RICH,
  cn = Re.SHOWN,
  dn = Re.SHOWING,
  Wt = Re.SHOWING_TRANSITION,
  At = Re.HIDE,
  Ft = Re.HIDE_TRANSITION,
  Gr = Re.MULTILINE_TOOLTIP,
  mn;
(function (n) {
  n.POLL_ANCHOR = 'poll_anchor';
})(mn || (mn = {}));
var On = typeof window < 'u',
  Vr = (function (n) {
    Rt(e, n);
    function e(t) {
      var r = n.call(this, Me(Me({}, e.defaultAdapter), t)) || this;
      return (
        (r.tooltipShown = !1),
        (r.anchorGap = Te.BOUNDED_ANCHOR_GAP),
        (r.xTooltipPos = st.DETECTED),
        (r.yTooltipPos = pt.DETECTED),
        (r.tooltipPositionWithCaret = V.DETECTED),
        (r.minViewportTooltipThreshold = Te.MIN_VIEWPORT_TOOLTIP_THRESHOLD),
        (r.hideDelayMs = Te.HIDE_DELAY_MS),
        (r.showDelayMs = Te.SHOW_DELAY_MS),
        (r.anchorRect = null),
        (r.parentRect = null),
        (r.frameId = null),
        (r.hideTimeout = null),
        (r.showTimeout = null),
        (r.addAncestorScrollEventListeners = new Array()),
        (r.removeAncestorScrollEventListeners = new Array()),
        (r.animFrame = new Ur()),
        (r.anchorBlurHandler = function (i) {
          r.handleAnchorBlur(i);
        }),
        (r.documentClickHandler = function (i) {
          r.handleDocumentClick(i);
        }),
        (r.documentKeydownHandler = function (i) {
          r.handleKeydown(i);
        }),
        (r.tooltipMouseEnterHandler = function () {
          r.handleTooltipMouseEnter();
        }),
        (r.tooltipMouseLeaveHandler = function () {
          r.handleTooltipMouseLeave();
        }),
        (r.richTooltipFocusOutHandler = function (i) {
          r.handleRichTooltipFocusOut(i);
        }),
        (r.windowScrollHandler = function () {
          r.handleWindowScrollEvent();
        }),
        (r.windowResizeHandler = function () {
          r.handleWindowChangeEvent();
        }),
        r
      );
    }
    return (
      Object.defineProperty(e, 'defaultAdapter', {
        get: function () {
          return {
            getAttribute: function () {
              return null;
            },
            setAttribute: function () {},
            removeAttribute: function () {},
            addClass: function () {},
            hasClass: function () {
              return !1;
            },
            removeClass: function () {},
            getComputedStyleProperty: function () {
              return '';
            },
            setStyleProperty: function () {},
            setSurfaceAnimationStyleProperty: function () {},
            getViewportWidth: function () {
              return 0;
            },
            getViewportHeight: function () {
              return 0;
            },
            getTooltipSize: function () {
              return { width: 0, height: 0 };
            },
            getAnchorBoundingRect: function () {
              return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 };
            },
            getParentBoundingRect: function () {
              return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 };
            },
            getAnchorAttribute: function () {
              return null;
            },
            setAnchorAttribute: function () {
              return null;
            },
            isRTL: function () {
              return !1;
            },
            anchorContainsElement: function () {
              return !1;
            },
            tooltipContainsElement: function () {
              return !1;
            },
            focusAnchorElement: function () {},
            registerEventHandler: function () {},
            deregisterEventHandler: function () {},
            registerAnchorEventHandler: function () {},
            deregisterAnchorEventHandler: function () {},
            registerDocumentEventHandler: function () {},
            deregisterDocumentEventHandler: function () {},
            registerWindowEventHandler: function () {},
            deregisterWindowEventHandler: function () {},
            notifyHidden: function () {},
            getTooltipCaretBoundingRect: function () {
              return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 };
            },
            setTooltipCaretStyle: function () {},
            clearTooltipCaretStyles: function () {},
            getActiveElement: function () {
              return null;
            },
          };
        },
        enumerable: !1,
        configurable: !0,
      }),
      (e.prototype.init = function () {
        (this.richTooltip = this.adapter.hasClass(Fr)),
          (this.persistentTooltip = this.adapter.getAttribute(Ut.PERSISTENT) === 'true'),
          (this.interactiveTooltip =
            !!this.adapter.getAnchorAttribute(Ut.ARIA_EXPANDED) &&
            this.adapter.getAnchorAttribute(Ut.ARIA_HASPOPUP) === 'dialog'),
          (this.hasCaret = this.richTooltip && this.adapter.getAttribute(Ut.HAS_CARET) === 'true');
      }),
      (e.prototype.isShown = function () {
        return this.tooltipShown;
      }),
      (e.prototype.isRich = function () {
        return this.richTooltip;
      }),
      (e.prototype.isPersistent = function () {
        return this.persistentTooltip;
      }),
      (e.prototype.handleAnchorMouseEnter = function () {
        var t = this;
        this.tooltipShown
          ? this.show()
          : (this.clearHideTimeout(),
            (this.showTimeout = setTimeout(function () {
              t.show();
            }, this.showDelayMs)));
      }),
      (e.prototype.handleAnchorTouchstart = function () {
        var t = this;
        (this.showTimeout = setTimeout(function () {
          t.show();
        }, this.showDelayMs)),
          this.adapter.registerWindowEventHandler(
            'contextmenu',
            this.preventContextMenuOnLongTouch
          );
      }),
      (e.prototype.preventContextMenuOnLongTouch = function (t) {
        t.preventDefault();
      }),
      (e.prototype.handleAnchorTouchend = function () {
        this.clearShowTimeout(),
          this.isShown() ||
            this.adapter.deregisterWindowEventHandler(
              'contextmenu',
              this.preventContextMenuOnLongTouch
            );
      }),
      (e.prototype.handleAnchorFocus = function (t) {
        var r = this,
          i = t.relatedTarget,
          a = i instanceof HTMLElement && this.adapter.tooltipContainsElement(i);
        a ||
          (this.showTimeout = setTimeout(function () {
            r.show();
          }, this.showDelayMs));
      }),
      (e.prototype.handleAnchorMouseLeave = function () {
        var t = this;
        this.clearShowTimeout(),
          (this.hideTimeout = setTimeout(function () {
            t.hide();
          }, this.hideDelayMs));
      }),
      (e.prototype.handleAnchorClick = function () {
        this.tooltipShown ? this.hide() : this.show();
      }),
      (e.prototype.handleDocumentClick = function (t) {
        var r =
          t.target instanceof HTMLElement &&
          (this.adapter.anchorContainsElement(t.target) ||
            this.adapter.tooltipContainsElement(t.target));
        (this.richTooltip && this.persistentTooltip && r) || this.hide();
      }),
      (e.prototype.handleKeydown = function (t) {
        var r = Dr(t);
        if (r === q.ESCAPE) {
          var i = this.adapter.getActiveElement(),
            a = i instanceof HTMLElement && this.adapter.tooltipContainsElement(i);
          a && this.adapter.focusAnchorElement(), this.hide();
        }
      }),
      (e.prototype.handleAnchorBlur = function (t) {
        if (this.richTooltip) {
          var r =
            t.relatedTarget instanceof HTMLElement &&
            this.adapter.tooltipContainsElement(t.relatedTarget);
          if (r || (t.relatedTarget === null && this.interactiveTooltip)) return;
        }
        this.hide();
      }),
      (e.prototype.handleTooltipMouseEnter = function () {
        this.show();
      }),
      (e.prototype.handleTooltipMouseLeave = function () {
        var t = this;
        this.clearShowTimeout(),
          (this.hideTimeout = setTimeout(function () {
            t.hide();
          }, this.hideDelayMs));
      }),
      (e.prototype.handleRichTooltipFocusOut = function (t) {
        var r =
          t.relatedTarget instanceof HTMLElement &&
          (this.adapter.anchorContainsElement(t.relatedTarget) ||
            this.adapter.tooltipContainsElement(t.relatedTarget));
        r || (t.relatedTarget === null && this.interactiveTooltip) || this.hide();
      }),
      (e.prototype.handleWindowScrollEvent = function () {
        if (this.persistentTooltip) {
          this.handleWindowChangeEvent();
          return;
        }
        this.hide();
      }),
      (e.prototype.handleWindowChangeEvent = function () {
        var t = this;
        this.animFrame.request(mn.POLL_ANCHOR, function () {
          t.repositionTooltipOnAnchorMove();
        });
      }),
      (e.prototype.show = function () {
        var t,
          r,
          i = this;
        if ((this.clearHideTimeout(), this.clearShowTimeout(), !this.tooltipShown)) {
          (this.tooltipShown = !0),
            this.adapter.removeAttribute('aria-hidden'),
            this.richTooltip &&
              (this.interactiveTooltip && this.adapter.setAnchorAttribute('aria-expanded', 'true'),
              this.adapter.registerEventHandler('focusout', this.richTooltipFocusOutHandler)),
            this.persistentTooltip ||
              (this.adapter.registerEventHandler('mouseenter', this.tooltipMouseEnterHandler),
              this.adapter.registerEventHandler('mouseleave', this.tooltipMouseLeaveHandler)),
            this.adapter.removeClass(At),
            this.adapter.addClass(dn),
            this.isTooltipMultiline() && !this.richTooltip && this.adapter.addClass(Gr),
            (this.anchorRect = this.adapter.getAnchorBoundingRect()),
            (this.parentRect = this.adapter.getParentBoundingRect()),
            this.richTooltip ? this.positionRichTooltip() : this.positionPlainTooltip(),
            this.adapter.registerAnchorEventHandler('blur', this.anchorBlurHandler),
            this.adapter.registerDocumentEventHandler('click', this.documentClickHandler),
            this.adapter.registerDocumentEventHandler('keydown', this.documentKeydownHandler),
            this.adapter.registerWindowEventHandler('scroll', this.windowScrollHandler),
            this.adapter.registerWindowEventHandler('resize', this.windowResizeHandler);
          try {
            for (
              var a = Ue(this.addAncestorScrollEventListeners), s = a.next();
              !s.done;
              s = a.next()
            ) {
              var o = s.value;
              o();
            }
          } catch (l) {
            t = { error: l };
          } finally {
            try {
              s && !s.done && (r = a.return) && r.call(a);
            } finally {
              if (t) throw t.error;
            }
          }
          this.frameId = requestAnimationFrame(function () {
            i.clearAllAnimationClasses(), i.adapter.addClass(cn), i.adapter.addClass(Wt);
          });
        }
      }),
      (e.prototype.hide = function () {
        var t, r;
        if ((this.clearHideTimeout(), this.clearShowTimeout(), !!this.tooltipShown)) {
          this.frameId && cancelAnimationFrame(this.frameId),
            (this.tooltipShown = !1),
            this.adapter.setAttribute('aria-hidden', 'true'),
            this.adapter.deregisterEventHandler('focusout', this.richTooltipFocusOutHandler),
            this.richTooltip &&
              this.interactiveTooltip &&
              this.adapter.setAnchorAttribute('aria-expanded', 'false'),
            this.persistentTooltip ||
              (this.adapter.deregisterEventHandler('mouseenter', this.tooltipMouseEnterHandler),
              this.adapter.deregisterEventHandler('mouseleave', this.tooltipMouseLeaveHandler)),
            this.clearAllAnimationClasses(),
            this.adapter.addClass(At),
            this.adapter.addClass(Ft),
            this.adapter.removeClass(cn),
            this.adapter.deregisterAnchorEventHandler('blur', this.anchorBlurHandler),
            this.adapter.deregisterDocumentEventHandler('click', this.documentClickHandler),
            this.adapter.deregisterDocumentEventHandler('keydown', this.documentKeydownHandler),
            this.adapter.deregisterWindowEventHandler('scroll', this.windowScrollHandler),
            this.adapter.deregisterWindowEventHandler('resize', this.windowResizeHandler),
            this.adapter.deregisterWindowEventHandler(
              'contextmenu',
              this.preventContextMenuOnLongTouch
            );
          try {
            for (
              var i = Ue(this.removeAncestorScrollEventListeners), a = i.next();
              !a.done;
              a = i.next()
            ) {
              var s = a.value;
              s();
            }
          } catch (o) {
            t = { error: o };
          } finally {
            try {
              a && !a.done && (r = i.return) && r.call(i);
            } finally {
              if (t) throw t.error;
            }
          }
        }
      }),
      (e.prototype.handleTransitionEnd = function () {
        var t = this.adapter.hasClass(At);
        this.adapter.removeClass(dn),
          this.adapter.removeClass(Wt),
          this.adapter.removeClass(At),
          this.adapter.removeClass(Ft),
          t && this.showTimeout === null && this.adapter.notifyHidden();
      }),
      (e.prototype.clearAllAnimationClasses = function () {
        this.adapter.removeClass(Wt), this.adapter.removeClass(Ft);
      }),
      (e.prototype.setTooltipPosition = function (t) {
        var r = t.xPos,
          i = t.yPos,
          a = t.withCaretPos;
        if (this.hasCaret && a) {
          this.tooltipPositionWithCaret = a;
          return;
        }
        r && (this.xTooltipPos = r), i && (this.yTooltipPos = i);
      }),
      (e.prototype.setAnchorBoundaryType = function (t) {
        t === Yt.UNBOUNDED
          ? (this.anchorGap = Te.UNBOUNDED_ANCHOR_GAP)
          : (this.anchorGap = Te.BOUNDED_ANCHOR_GAP);
      }),
      (e.prototype.setShowDelay = function (t) {
        this.showDelayMs = t;
      }),
      (e.prototype.setHideDelay = function (t) {
        this.hideDelayMs = t;
      }),
      (e.prototype.isTooltipMultiline = function () {
        var t = this.adapter.getTooltipSize();
        return t.height > Te.MIN_HEIGHT && t.width >= Te.MAX_WIDTH;
      }),
      (e.prototype.positionPlainTooltip = function () {
        var t = this.calculateTooltipStyles(this.anchorRect),
          r = t.top,
          i = t.yTransformOrigin,
          a = t.left,
          s = t.xTransformOrigin,
          o = On ? Sn(window, 'transform') : 'transform';
        this.adapter.setSurfaceAnimationStyleProperty(o + '-origin', s + ' ' + i),
          this.adapter.setStyleProperty('top', r + 'px'),
          this.adapter.setStyleProperty('left', a + 'px');
      }),
      (e.prototype.positionRichTooltip = function () {
        var t,
          r,
          i,
          a,
          s = this.adapter.getComputedStyleProperty('width');
        this.adapter.setStyleProperty('width', s);
        var o = this.hasCaret
            ? this.calculateTooltipWithCaretStyles(this.anchorRect)
            : this.calculateTooltipStyles(this.anchorRect),
          l = o.top,
          u = o.yTransformOrigin,
          d = o.left,
          c = o.xTransformOrigin,
          f = On ? Sn(window, 'transform') : 'transform';
        this.adapter.setSurfaceAnimationStyleProperty(f + '-origin', c + ' ' + u);
        var g =
            d -
            ((r = (t = this.parentRect) === null || t === void 0 ? void 0 : t.left) !== null &&
            r !== void 0
              ? r
              : 0),
          _ =
            l -
            ((a = (i = this.parentRect) === null || i === void 0 ? void 0 : i.top) !== null &&
            a !== void 0
              ? a
              : 0);
        this.adapter.setStyleProperty('top', _ + 'px'),
          this.adapter.setStyleProperty('left', g + 'px');
      }),
      (e.prototype.calculateTooltipStyles = function (t) {
        if (!t) return { top: 0, left: 0 };
        var r = this.adapter.getTooltipSize(),
          i = this.calculateYTooltipDistance(t, r.height),
          a = this.calculateXTooltipDistance(t, r.width);
        return {
          top: i.distance,
          yTransformOrigin: i.yTransformOrigin,
          left: a.distance,
          xTransformOrigin: a.xTransformOrigin,
        };
      }),
      (e.prototype.calculateXTooltipDistance = function (t, r) {
        var i = !this.adapter.isRTL(),
          a,
          s,
          o,
          l,
          u;
        this.richTooltip
          ? ((a = i ? t.left - r : t.right),
            (s = i ? t.right : t.left - r),
            (l = i ? U.RIGHT : U.LEFT),
            (u = i ? U.LEFT : U.RIGHT))
          : ((a = i ? t.left : t.right - r),
            (s = i ? t.right - r : t.left),
            (o = t.left + (t.width - r) / 2),
            (l = i ? U.LEFT : U.RIGHT),
            (u = i ? U.RIGHT : U.LEFT));
        var d = this.richTooltip
          ? this.determineValidPositionOptions(a, s)
          : this.determineValidPositionOptions(o, a, s);
        if (this.xTooltipPos === st.START && d.has(a)) return { distance: a, xTransformOrigin: l };
        if (this.xTooltipPos === st.END && d.has(s)) return { distance: s, xTransformOrigin: u };
        if (this.xTooltipPos === st.CENTER && d.has(o))
          return { distance: o, xTransformOrigin: U.CENTER };
        var c = this.richTooltip
            ? [
                { distance: s, xTransformOrigin: u },
                { distance: a, xTransformOrigin: l },
              ]
            : [
                { distance: o, xTransformOrigin: U.CENTER },
                { distance: a, xTransformOrigin: l },
                { distance: s, xTransformOrigin: u },
              ],
          f = c.find(function (E) {
            var p = E.distance;
            return d.has(p);
          });
        if (f) return f;
        if (t.left < 0)
          return { distance: this.minViewportTooltipThreshold, xTransformOrigin: U.LEFT };
        var g = this.adapter.getViewportWidth(),
          _ = g - (r + this.minViewportTooltipThreshold);
        return { distance: _, xTransformOrigin: U.RIGHT };
      }),
      (e.prototype.determineValidPositionOptions = function () {
        for (var t, r, i = [], a = 0; a < arguments.length; a++) i[a] = arguments[a];
        var s = new Set(),
          o = new Set();
        try {
          for (var l = Ue(i), u = l.next(); !u.done; u = l.next()) {
            var d = u.value;
            this.positionHonorsViewportThreshold(d)
              ? s.add(d)
              : this.positionDoesntCollideWithViewport(d) && o.add(d);
          }
        } catch (c) {
          t = { error: c };
        } finally {
          try {
            u && !u.done && (r = l.return) && r.call(l);
          } finally {
            if (t) throw t.error;
          }
        }
        return s.size ? s : o;
      }),
      (e.prototype.positionHonorsViewportThreshold = function (t) {
        var r = this.adapter.getViewportWidth(),
          i = this.adapter.getTooltipSize().width;
        return (
          t + i <= r - this.minViewportTooltipThreshold && t >= this.minViewportTooltipThreshold
        );
      }),
      (e.prototype.positionDoesntCollideWithViewport = function (t) {
        var r = this.adapter.getViewportWidth(),
          i = this.adapter.getTooltipSize().width;
        return t + i <= r && t >= 0;
      }),
      (e.prototype.calculateYTooltipDistance = function (t, r) {
        var i = t.bottom + this.anchorGap,
          a = t.top - (this.anchorGap + r),
          s = this.determineValidYPositionOptions(a, i);
        return this.yTooltipPos === pt.ABOVE && s.has(a)
          ? { distance: a, yTransformOrigin: U.BOTTOM }
          : this.yTooltipPos === pt.BELOW && s.has(i)
          ? { distance: i, yTransformOrigin: U.TOP }
          : s.has(i)
          ? { distance: i, yTransformOrigin: U.TOP }
          : s.has(a)
          ? { distance: a, yTransformOrigin: U.BOTTOM }
          : { distance: i, yTransformOrigin: U.TOP };
      }),
      (e.prototype.determineValidYPositionOptions = function (t, r) {
        var i = new Set(),
          a = new Set();
        return (
          this.yPositionHonorsViewportThreshold(t)
            ? i.add(t)
            : this.yPositionDoesntCollideWithViewport(t) && a.add(t),
          this.yPositionHonorsViewportThreshold(r)
            ? i.add(r)
            : this.yPositionDoesntCollideWithViewport(r) && a.add(r),
          i.size ? i : a
        );
      }),
      (e.prototype.yPositionHonorsViewportThreshold = function (t) {
        var r = this.adapter.getViewportHeight(),
          i = this.adapter.getTooltipSize().height;
        return (
          t + i + this.minViewportTooltipThreshold <= r && t >= this.minViewportTooltipThreshold
        );
      }),
      (e.prototype.yPositionDoesntCollideWithViewport = function (t) {
        var r = this.adapter.getViewportHeight(),
          i = this.adapter.getTooltipSize().height;
        return t + i <= r && t >= 0;
      }),
      (e.prototype.calculateTooltipWithCaretStyles = function (t) {
        this.adapter.clearTooltipCaretStyles();
        var r = this.adapter.getTooltipCaretBoundingRect();
        if (!t || !r) return { position: V.DETECTED, top: 0, left: 0 };
        var i = r.width / Te.ANIMATION_SCALE,
          a = r.height / Te.ANIMATION_SCALE / 2,
          s = this.adapter.getTooltipSize(),
          o = this.calculateYWithCaretDistanceOptions(t, s.height, {
            caretWidth: i,
            caretHeight: a,
          }),
          l = this.calculateXWithCaretDistanceOptions(t, s.width, {
            caretWidth: i,
            caretHeight: a,
          }),
          u = this.validateTooltipWithCaretDistances(o, l);
        u.size < 1 &&
          (u = this.generateBackupPositionOption(t, s, { caretWidth: i, caretHeight: a }));
        var d = this.determineTooltipWithCaretDistance(u),
          c = d.position,
          f = d.xDistance,
          g = d.yDistance,
          _ = this.setCaretPositionStyles(c, { caretWidth: i, caretHeight: a }),
          E = _.yTransformOrigin,
          p = _.xTransformOrigin;
        return { yTransformOrigin: E, xTransformOrigin: p, top: g, left: f };
      }),
      (e.prototype.calculateXWithCaretDistanceOptions = function (t, r, i) {
        var a = i.caretWidth,
          s = i.caretHeight,
          o = !this.adapter.isRTL(),
          l = t.left + t.width / 2,
          u = t.left - (r + this.anchorGap + s),
          d = t.right + this.anchorGap + s,
          c = o ? u : d,
          f = o ? d : u,
          g = l - (Te.CARET_INDENTATION + a / 2),
          _ = l - (r - Te.CARET_INDENTATION - a / 2),
          E = o ? g : _,
          p = o ? _ : g,
          v = l - r / 2,
          A = new Map([
            [X.START, E],
            [X.CENTER, v],
            [X.END, p],
            [X.SIDE_END, f],
            [X.SIDE_START, c],
          ]);
        return A;
      }),
      (e.prototype.calculateYWithCaretDistanceOptions = function (t, r, i) {
        var a = i.caretWidth,
          s = i.caretHeight,
          o = t.top + t.height / 2,
          l = t.bottom + this.anchorGap + s,
          u = t.top - (this.anchorGap + r + s),
          d = o - (Te.CARET_INDENTATION + a / 2),
          c = o - r / 2,
          f = o - (r - Te.CARET_INDENTATION - a / 2),
          g = new Map([
            [ue.ABOVE, u],
            [ue.BELOW, l],
            [ue.SIDE_TOP, d],
            [ue.SIDE_CENTER, c],
            [ue.SIDE_BOTTOM, f],
          ]);
        return g;
      }),
      (e.prototype.repositionTooltipOnAnchorMove = function () {
        var t = this.adapter.getAnchorBoundingRect();
        !t ||
          !this.anchorRect ||
          ((t.top !== this.anchorRect.top ||
            t.left !== this.anchorRect.left ||
            t.height !== this.anchorRect.height ||
            t.width !== this.anchorRect.width) &&
            ((this.anchorRect = t),
            (this.parentRect = this.adapter.getParentBoundingRect()),
            this.richTooltip ? this.positionRichTooltip() : this.positionPlainTooltip()));
      }),
      (e.prototype.validateTooltipWithCaretDistances = function (t, r) {
        var i,
          a,
          s,
          o,
          l,
          u,
          d = new Map(),
          c = new Map(),
          f = new Map([
            [ue.ABOVE, [X.START, X.CENTER, X.END]],
            [ue.BELOW, [X.START, X.CENTER, X.END]],
            [ue.SIDE_TOP, [X.SIDE_START, X.SIDE_END]],
            [ue.SIDE_CENTER, [X.SIDE_START, X.SIDE_END]],
            [ue.SIDE_BOTTOM, [X.SIDE_START, X.SIDE_END]],
          ]);
        try {
          for (var g = Ue(f.keys()), _ = g.next(); !_.done; _ = g.next()) {
            var E = _.value,
              p = t.get(E);
            if (this.yPositionHonorsViewportThreshold(p))
              try {
                for (var v = ((s = void 0), Ue(f.get(E))), A = v.next(); !A.done; A = v.next()) {
                  var H = A.value,
                    b = r.get(H);
                  if (this.positionHonorsViewportThreshold(b)) {
                    var C = this.caretPositionOptionsMapping(H, E);
                    d.set(C, { xDistance: b, yDistance: p });
                  }
                }
              } catch (W) {
                s = { error: W };
              } finally {
                try {
                  A && !A.done && (o = v.return) && o.call(v);
                } finally {
                  if (s) throw s.error;
                }
              }
            if (this.yPositionDoesntCollideWithViewport(p))
              try {
                for (var k = ((l = void 0), Ue(f.get(E))), S = k.next(); !S.done; S = k.next()) {
                  var H = S.value,
                    b = r.get(H);
                  if (this.positionDoesntCollideWithViewport(b)) {
                    var C = this.caretPositionOptionsMapping(H, E);
                    c.set(C, { xDistance: b, yDistance: p });
                  }
                }
              } catch (W) {
                l = { error: W };
              } finally {
                try {
                  S && !S.done && (u = k.return) && u.call(k);
                } finally {
                  if (l) throw l.error;
                }
              }
          }
        } catch (W) {
          i = { error: W };
        } finally {
          try {
            _ && !_.done && (a = g.return) && a.call(g);
          } finally {
            if (i) throw i.error;
          }
        }
        return d.size ? d : c;
      }),
      (e.prototype.generateBackupPositionOption = function (t, r, i) {
        var a = !this.adapter.isRTL(),
          s,
          o;
        if (t.left < 0)
          (s = this.minViewportTooltipThreshold + i.caretHeight), (o = a ? X.END : X.START);
        else {
          var l = this.adapter.getViewportWidth();
          (s = l - (r.width + this.minViewportTooltipThreshold + i.caretHeight)),
            (o = a ? X.START : X.END);
        }
        var u, d;
        if (t.top < 0) (u = this.minViewportTooltipThreshold + i.caretHeight), (d = ue.BELOW);
        else {
          var c = this.adapter.getViewportHeight();
          (u = c - (r.height + this.minViewportTooltipThreshold + i.caretHeight)), (d = ue.ABOVE);
        }
        var f = this.caretPositionOptionsMapping(o, d);
        return new Map([[f, { xDistance: s, yDistance: u }]]);
      }),
      (e.prototype.determineTooltipWithCaretDistance = function (t) {
        if (t.has(this.tooltipPositionWithCaret)) {
          var r = t.get(this.tooltipPositionWithCaret);
          return {
            position: this.tooltipPositionWithCaret,
            xDistance: r.xDistance,
            yDistance: r.yDistance,
          };
        }
        var i = [
            V.ABOVE_START,
            V.ABOVE_CENTER,
            V.ABOVE_END,
            V.TOP_SIDE_START,
            V.CENTER_SIDE_START,
            V.BOTTOM_SIDE_START,
            V.TOP_SIDE_END,
            V.CENTER_SIDE_END,
            V.BOTTOM_SIDE_END,
            V.BELOW_START,
            V.BELOW_CENTER,
            V.BELOW_END,
          ],
          a = i.find(function (o) {
            return t.has(o);
          }),
          s = t.get(a);
        return { position: a, xDistance: s.xDistance, yDistance: s.yDistance };
      }),
      (e.prototype.caretPositionOptionsMapping = function (t, r) {
        switch (r) {
          case ue.ABOVE:
            if (t === X.START) return V.ABOVE_START;
            if (t === X.CENTER) return V.ABOVE_CENTER;
            if (t === X.END) return V.ABOVE_END;
            break;
          case ue.BELOW:
            if (t === X.START) return V.BELOW_START;
            if (t === X.CENTER) return V.BELOW_CENTER;
            if (t === X.END) return V.BELOW_END;
            break;
          case ue.SIDE_TOP:
            if (t === X.SIDE_START) return V.TOP_SIDE_START;
            if (t === X.SIDE_END) return V.TOP_SIDE_END;
            break;
          case ue.SIDE_CENTER:
            if (t === X.SIDE_START) return V.CENTER_SIDE_START;
            if (t === X.SIDE_END) return V.CENTER_SIDE_END;
            break;
          case ue.SIDE_BOTTOM:
            if (t === X.SIDE_START) return V.BOTTOM_SIDE_START;
            if (t === X.SIDE_END) return V.BOTTOM_SIDE_END;
            break;
        }
        throw new Error('MDCTooltipFoundation: Invalid caret position of ' + t + ', ' + r);
      }),
      (e.prototype.setCaretPositionStyles = function (t, r) {
        var i,
          a,
          s = this.calculateCaretPositionOnTooltip(t, r);
        if (!s) return { yTransformOrigin: 0, xTransformOrigin: 0 };
        this.adapter.clearTooltipCaretStyles(),
          this.adapter.setTooltipCaretStyle(s.yAlignment, s.yAxisPx),
          this.adapter.setTooltipCaretStyle(s.xAlignment, s.xAxisPx);
        var o = s.skew * (Math.PI / 180),
          l = Math.cos(o);
        this.adapter.setTooltipCaretStyle(
          'transform',
          'rotate(' + s.rotation + 'deg) skewY(' + s.skew + 'deg) scaleX(' + l + ')'
        ),
          this.adapter.setTooltipCaretStyle('transform-origin', s.xAlignment + ' ' + s.yAlignment);
        try {
          for (var u = Ue(s.caretCorners), d = u.next(); !d.done; d = u.next()) {
            var c = d.value;
            this.adapter.setTooltipCaretStyle(c, '0');
          }
        } catch (f) {
          i = { error: f };
        } finally {
          try {
            d && !d.done && (a = u.return) && a.call(u);
          } finally {
            if (i) throw i.error;
          }
        }
        return { yTransformOrigin: s.yTransformOrigin, xTransformOrigin: s.xTransformOrigin };
      }),
      (e.prototype.calculateCaretPositionOnTooltip = function (t, r) {
        var i = !this.adapter.isRTL(),
          a = this.adapter.getComputedStyleProperty('width'),
          s = this.adapter.getComputedStyleProperty('height');
        if (!(!a || !s || !r)) {
          var o = 'calc((' + a + ' - ' + r.caretWidth + 'px) / 2)',
            l = 'calc((' + s + ' - ' + r.caretWidth + 'px) / 2)',
            u = '0',
            d = Te.CARET_INDENTATION + 'px',
            c = 'calc(' + a + ' - ' + d + ')',
            f = 'calc(' + s + ' - ' + d + ')',
            g = 35,
            _ = Math.abs(90 - g),
            E = ['border-bottom-right-radius', 'border-top-left-radius'],
            p = ['border-bottom-left-radius', 'border-top-right-radius'],
            v = 20;
          switch (t) {
            case V.BELOW_CENTER:
              return {
                yAlignment: U.TOP,
                xAlignment: U.LEFT,
                yAxisPx: u,
                xAxisPx: o,
                rotation: -1 * g,
                skew: -1 * v,
                xTransformOrigin: o,
                yTransformOrigin: u,
                caretCorners: E,
              };
            case V.BELOW_END:
              return {
                yAlignment: U.TOP,
                xAlignment: i ? U.RIGHT : U.LEFT,
                yAxisPx: u,
                xAxisPx: d,
                rotation: i ? g : -1 * g,
                skew: i ? v : -1 * v,
                xTransformOrigin: i ? c : d,
                yTransformOrigin: u,
                caretCorners: i ? p : E,
              };
            case V.BELOW_START:
              return {
                yAlignment: U.TOP,
                xAlignment: i ? U.LEFT : U.RIGHT,
                yAxisPx: u,
                xAxisPx: d,
                rotation: i ? -1 * g : g,
                skew: i ? -1 * v : v,
                xTransformOrigin: i ? d : c,
                yTransformOrigin: u,
                caretCorners: i ? E : p,
              };
            case V.TOP_SIDE_END:
              return {
                yAlignment: U.TOP,
                xAlignment: i ? U.LEFT : U.RIGHT,
                yAxisPx: d,
                xAxisPx: u,
                rotation: i ? _ : -1 * _,
                skew: i ? -1 * v : v,
                xTransformOrigin: i ? u : a,
                yTransformOrigin: d,
                caretCorners: i ? E : p,
              };
            case V.CENTER_SIDE_END:
              return {
                yAlignment: U.TOP,
                xAlignment: i ? U.LEFT : U.RIGHT,
                yAxisPx: l,
                xAxisPx: u,
                rotation: i ? _ : -1 * _,
                skew: i ? -1 * v : v,
                xTransformOrigin: i ? u : a,
                yTransformOrigin: l,
                caretCorners: i ? E : p,
              };
            case V.BOTTOM_SIDE_END:
              return {
                yAlignment: U.BOTTOM,
                xAlignment: i ? U.LEFT : U.RIGHT,
                yAxisPx: d,
                xAxisPx: u,
                rotation: i ? -1 * _ : _,
                skew: i ? v : -1 * v,
                xTransformOrigin: i ? u : a,
                yTransformOrigin: f,
                caretCorners: i ? p : E,
              };
            case V.TOP_SIDE_START:
              return {
                yAlignment: U.TOP,
                xAlignment: i ? U.RIGHT : U.LEFT,
                yAxisPx: d,
                xAxisPx: u,
                rotation: i ? -1 * _ : _,
                skew: i ? v : -1 * v,
                xTransformOrigin: i ? a : u,
                yTransformOrigin: d,
                caretCorners: i ? p : E,
              };
            case V.CENTER_SIDE_START:
              return {
                yAlignment: U.TOP,
                xAlignment: i ? U.RIGHT : U.LEFT,
                yAxisPx: l,
                xAxisPx: u,
                rotation: i ? -1 * _ : _,
                skew: i ? v : -1 * v,
                xTransformOrigin: i ? a : u,
                yTransformOrigin: l,
                caretCorners: i ? p : E,
              };
            case V.BOTTOM_SIDE_START:
              return {
                yAlignment: U.BOTTOM,
                xAlignment: i ? U.RIGHT : U.LEFT,
                yAxisPx: d,
                xAxisPx: u,
                rotation: i ? _ : -1 * _,
                skew: i ? -1 * v : v,
                xTransformOrigin: i ? a : u,
                yTransformOrigin: f,
                caretCorners: i ? E : p,
              };
            case V.ABOVE_CENTER:
              return {
                yAlignment: U.BOTTOM,
                xAlignment: U.LEFT,
                yAxisPx: u,
                xAxisPx: o,
                rotation: g,
                skew: v,
                xTransformOrigin: o,
                yTransformOrigin: s,
                caretCorners: p,
              };
            case V.ABOVE_END:
              return {
                yAlignment: U.BOTTOM,
                xAlignment: i ? U.RIGHT : U.LEFT,
                yAxisPx: u,
                xAxisPx: d,
                rotation: i ? -1 * g : g,
                skew: i ? -1 * v : v,
                xTransformOrigin: i ? c : d,
                yTransformOrigin: s,
                caretCorners: i ? E : p,
              };
            default:
            case V.ABOVE_START:
              return {
                yAlignment: U.BOTTOM,
                xAlignment: i ? U.LEFT : U.RIGHT,
                yAxisPx: u,
                xAxisPx: d,
                rotation: i ? g : -1 * g,
                skew: i ? v : -1 * v,
                xTransformOrigin: i ? d : c,
                yTransformOrigin: s,
                caretCorners: i ? p : E,
              };
          }
        }
      }),
      (e.prototype.clearShowTimeout = function () {
        this.showTimeout && (clearTimeout(this.showTimeout), (this.showTimeout = null));
      }),
      (e.prototype.clearHideTimeout = function () {
        this.hideTimeout && (clearTimeout(this.hideTimeout), (this.hideTimeout = null));
      }),
      (e.prototype.attachScrollHandler = function (t) {
        var r = this;
        this.addAncestorScrollEventListeners.push(function () {
          t('scroll', r.windowScrollHandler);
        });
      }),
      (e.prototype.removeScrollHandler = function (t) {
        var r = this;
        this.removeAncestorScrollEventListeners.push(function () {
          t('scroll', r.windowScrollHandler);
        });
      }),
      (e.prototype.destroy = function () {
        var t, r;
        this.frameId && (cancelAnimationFrame(this.frameId), (this.frameId = null)),
          this.clearHideTimeout(),
          this.clearShowTimeout(),
          this.adapter.removeClass(cn),
          this.adapter.removeClass(Wt),
          this.adapter.removeClass(dn),
          this.adapter.removeClass(At),
          this.adapter.removeClass(Ft),
          this.richTooltip &&
            this.adapter.deregisterEventHandler('focusout', this.richTooltipFocusOutHandler),
          this.persistentTooltip ||
            (this.adapter.deregisterEventHandler('mouseenter', this.tooltipMouseEnterHandler),
            this.adapter.deregisterEventHandler('mouseleave', this.tooltipMouseLeaveHandler)),
          this.adapter.deregisterAnchorEventHandler('blur', this.anchorBlurHandler),
          this.adapter.deregisterDocumentEventHandler('click', this.documentClickHandler),
          this.adapter.deregisterDocumentEventHandler('keydown', this.documentKeydownHandler),
          this.adapter.deregisterWindowEventHandler('scroll', this.windowScrollHandler),
          this.adapter.deregisterWindowEventHandler('resize', this.windowResizeHandler);
        try {
          for (
            var i = Ue(this.removeAncestorScrollEventListeners), a = i.next();
            !a.done;
            a = i.next()
          ) {
            var s = a.value;
            s();
          }
        } catch (o) {
          t = { error: o };
        } finally {
          try {
            a && !a.done && (r = i.return) && r.call(i);
          } finally {
            if (t) throw t.error;
          }
        }
        this.animFrame.cancelAll();
      }),
      e
    );
  })(Dt);
function zr(n) {
  let e, t, r, i, a, s, o, l, u, d, c, f, g;
  const _ = n[32].default,
    E = Ee(_, n, n[31], null);
  let p = [
      {
        class: (r = x({
          [n[6]]: !0,
          'mdc-tooltip__surface': !0,
          'mdc-tooltip__surface-animation': !0,
        })),
      },
      { style: (i = Object.entries(n[13]).map(Rn).concat([n[7]]).join(' ')) },
      ft(n[19], 'surface$'),
    ],
    v = {};
  for (let b = 0; b < p.length; b += 1) v = F(v, p[b]);
  let A = [
      { class: (a = x({ [n[1]]: !0, 'mdc-tooltip': !0, 'mdc-tooltip--rich': n[18], ...n[10] })) },
      { style: (s = Object.entries(n[11]).map(Dn).concat([n[2]]).join(' ')) },
      { 'aria-hidden': 'true' },
      { id: n[3] },
      { 'data-mdc-tooltip-persist': (o = n[18] && n[4] ? 'true' : void 0) },
      { 'data-mdc-tooltip-persistent': (l = n[18] && n[4] ? 'true' : void 0) },
      { 'data-mdc-tooltip-has-caret': void 0 },
      { 'data-hide-tooltip-from-screenreader': (u = n[5] ? 'true' : void 0) },
      n[14],
      n[12],
      Qt(n[19], ['surface$']),
    ],
    H = {};
  for (let b = 0; b < A.length; b += 1) H = F(H, A[b]);
  return {
    c() {
      (e = J('div')), (t = J('div')), E && E.c(), te(t, v), te(e, H);
    },
    m(b, C) {
      I(b, e, C),
        $(e, t),
        E && E.m(t, null),
        n[33](e),
        (c = !0),
        f ||
          ((g = [
            ee((d = De.call(null, e, n[0]))),
            ee(n[15].call(null, e)),
            ie(e, 'transitionend', n[34]),
          ]),
          (f = !0));
    },
    p(b, C) {
      E &&
        E.p &&
        (!c || C[1] & 1) &&
        ve(E, _, b, b[31], c ? be(_, b[31], C, null) : Ae(b[31]), null),
        te(
          t,
          (v = le(p, [
            (!c ||
              (C[0] & 64 &&
                r !==
                  (r = x({
                    [b[6]]: !0,
                    'mdc-tooltip__surface': !0,
                    'mdc-tooltip__surface-animation': !0,
                  })))) && { class: r },
            (!c ||
              (C[0] & 8320 &&
                i !== (i = Object.entries(b[13]).map(Rn).concat([b[7]]).join(' ')))) && {
              style: i,
            },
            C[0] & 524288 && ft(b[19], 'surface$'),
          ]))
        ),
        te(
          e,
          (H = le(A, [
            (!c ||
              (C[0] & 1026 &&
                a !==
                  (a = x({
                    [b[1]]: !0,
                    'mdc-tooltip': !0,
                    'mdc-tooltip--rich': b[18],
                    ...b[10],
                  })))) && { class: a },
            (!c ||
              (C[0] & 2052 &&
                s !== (s = Object.entries(b[11]).map(Dn).concat([b[2]]).join(' ')))) && {
              style: s,
            },
            { 'aria-hidden': 'true' },
            (!c || C[0] & 8) && { id: b[3] },
            (!c || (C[0] & 16 && o !== (o = b[18] && b[4] ? 'true' : void 0))) && {
              'data-mdc-tooltip-persist': o,
            },
            (!c || (C[0] & 16 && l !== (l = b[18] && b[4] ? 'true' : void 0))) && {
              'data-mdc-tooltip-persistent': l,
            },
            { 'data-mdc-tooltip-has-caret': void 0 },
            (!c || (C[0] & 32 && u !== (u = b[5] ? 'true' : void 0))) && {
              'data-hide-tooltip-from-screenreader': u,
            },
            C[0] & 16384 && b[14],
            C[0] & 4096 && b[12],
            C[0] & 524288 && Qt(b[19], ['surface$']),
          ]))
        ),
        d && me(d.update) && C[0] & 1 && d.update.call(null, b[0]);
    },
    i(b) {
      c || (w(E, b), (c = !0));
    },
    o(b) {
      L(E, b), (c = !1);
    },
    d(b) {
      b && D(e), E && E.d(b), n[33](null), (f = !1), he(g);
    },
  };
}
let jr = 0;
const Rn = ([n, e]) => `${n}: ${e};`,
  Dn = ([n, e]) => `${n}: ${e};`;
function Kr(n, e, t) {
  let r;
  const i = [
    'use',
    'class',
    'style',
    'id',
    'unbounded',
    'xPos',
    'yPos',
    'persistent',
    'interactive',
    'hideFromScreenreader',
    'showDelay',
    'hideDelay',
    'surface$class',
    'surface$style',
    'attachScrollHandler',
    'removeScrollHandler',
    'getElement',
  ];
  let a = re(e, i),
    s,
    o,
    { $$slots: l = {}, $$scope: u } = e;
  const d = ze(Ce());
  let { use: c = [] } = e,
    { class: f = '' } = e,
    { style: g = '' } = e,
    { id: _ = 'SMUI-tooltip-' + jr++ } = e,
    { unbounded: E = !1 } = e,
    { xPos: p = 'detected' } = e,
    { yPos: v = 'detected' } = e,
    { persistent: A = !1 } = e,
    { interactive: H = A } = e,
    { hideFromScreenreader: b = !1 } = e,
    { showDelay: C = void 0 } = e,
    { hideDelay: k = void 0 } = e,
    { surface$class: S = '' } = e,
    { surface$style: W = '' } = e,
    G,
    T,
    O = {
      setParent(h) {
        Object.defineProperty(this, 'parent', { value: h });
      },
      setNextSibling(h) {
        Object.defineProperty(this, 'nextSibling', { value: h });
      },
    },
    y = {},
    N = {},
    Z = {},
    Le = {},
    We = ye('SMUI:tooltip:wrapper:anchor');
  Qe(n, We, (h) => t(30, (s = h)));
  let Pe = ye('SMUI:tooltip:wrapper:tooltip');
  Qe(n, Pe, (h) => t(35, (o = h)));
  const ae = ye('SMUI:tooltip:rich');
  let M;
  $e(
    () => (
      t(
        8,
        (T = new Vr({
          getAttribute: Fe,
          setAttribute: rt,
          removeAttribute: vt,
          addClass: _t,
          hasClass: Je,
          removeClass: gt,
          getComputedStyleProperty: (h) => {
            const P = m();
            let Ye = getComputedStyle(P).getPropertyValue(h);
            return (
              Ye === 'auto' &&
                (P.classList.add('smui-banner--force-show'),
                (Ye = getComputedStyle(P).getPropertyValue(h)),
                P.classList.remove('smui-banner--force-show')),
              Ye
            );
          },
          setStyleProperty: Et,
          setSurfaceAnimationStyleProperty: bt,
          getViewportWidth: () => window.innerWidth,
          getViewportHeight: () => window.innerHeight,
          getTooltipSize: () => {
            const h = m();
            let P = { width: h.offsetWidth, height: h.offsetHeight };
            return (
              (P.width === 0 || P.height === 0) &&
                (h.classList.add('smui-banner--force-show'),
                (P = { width: h.offsetWidth, height: h.offsetHeight }),
                h.classList.remove('smui-banner--force-show')),
              P
            );
          },
          getAnchorBoundingRect: () => (s ? s.getBoundingClientRect() : null),
          getParentBoundingRect: () => {
            let h = m().parentElement;
            return (
              ae || (h = document.body), (h == null ? void 0 : h.getBoundingClientRect()) || null
            );
          },
          getAnchorAttribute: (h) => (s ? s.getAttribute(h) : null),
          setAnchorAttribute: (h, P) => {
            s && s.setAttribute(h, P);
          },
          isRTL: () => getComputedStyle(m()).direction === 'rtl',
          anchorContainsElement: (h) => !!(s && s.contains(h)),
          tooltipContainsElement: (h) => m().contains(h),
          focusAnchorElement: () => {
            s && s.focus();
          },
          registerEventHandler: (h, P) => {
            m().addEventListener(h, P);
          },
          deregisterEventHandler: (h, P) => {
            m().removeEventListener(h, P);
          },
          registerAnchorEventHandler: (h, P) => {
            s && s.addEventListener(h, P);
          },
          deregisterAnchorEventHandler: (h, P) => {
            s && s.removeEventListener(h, P);
          },
          registerDocumentEventHandler: (h, P) => {
            document.body.addEventListener(h, P);
          },
          deregisterDocumentEventHandler: (h, P) => {
            document.body.removeEventListener(h, P);
          },
          registerWindowEventHandler: (h, P) => {
            window.addEventListener(h, P, h === 'scroll' && { capture: !0, passive: !0 });
          },
          deregisterWindowEventHandler: (h, P) => {
            window.removeEventListener(h, P, h === 'scroll' && { capture: !0, passive: !0 });
          },
          notifyHidden: () => {
            se(m(), 'SMUITooltip:hidden', void 0, void 0, !0);
          },
          getTooltipCaretBoundingRect: () => {
            const h = m().querySelector(`.${Re.TOOLTIP_CARET_TOP}`);
            return h ? h.getBoundingClientRect() : null;
          },
          setTooltipCaretStyle: (h, P) => {
            const Ye = m().querySelector(`.${Re.TOOLTIP_CARET_TOP}`),
              kt = m().querySelector(`.${Re.TOOLTIP_CARET_BOTTOM}`);
            !Ye || !kt || (Ye.style.setProperty(h, P), kt.style.setProperty(h, P));
          },
          clearTooltipCaretStyles: () => {
            const h = m().querySelector(`.${Re.TOOLTIP_CARET_TOP}`),
              P = m().querySelector(`.${Re.TOOLTIP_CARET_BOTTOM}`);
            !h || !P || (h.removeAttribute('style'), P.removeAttribute('style'));
          },
          getActiveElement: () => document.activeElement,
        }))
      ),
      jt(Pe, (o = G), o),
      () => {
        s && ge(s);
      }
    )
  ),
    xt(() => {
      var h;
      !ae &&
        typeof document < 'u' &&
        document.body === m().parentElement &&
        O.parent !== m().parentElement &&
        !((h = O.parent) === null || h === void 0) &&
        h.insertBefore &&
        O.nextSibling &&
        O.parent.insertBefore(m(), O.nextSibling);
    });
  function ge(h) {
    h.removeEventListener('focusout', lt),
      ae && A
        ? (h.removeEventListener('click', R), h.removeEventListener('keydown', R))
        : (h.removeEventListener('mouseenter', pe),
          h.removeEventListener('focusin', Be),
          h.removeEventListener('mouseleave', It),
          h.removeEventListener('touchstart', Ht),
          h.removeEventListener('touchend', Lt)),
      ae && H
        ? (h.removeAttribute('aria-haspopup'),
          h.removeAttribute('aria-expanded'),
          h.removeAttribute('data-tooltip-id'))
        : h.removeAttribute('aria-describedby'),
      T.destroy();
  }
  function qe(h) {
    h.addEventListener('focusout', lt),
      ae && A
        ? (h.addEventListener('click', R), h.addEventListener('keydown', R))
        : (h.addEventListener('mouseenter', pe),
          h.addEventListener('focusin', Be),
          h.addEventListener('mouseleave', It),
          h.addEventListener('touchstart', Ht),
          h.addEventListener('touchend', Lt)),
      ae && H
        ? (h.setAttribute('aria-haspopup', 'dialog'),
          h.setAttribute('aria-expanded', 'false'),
          h.setAttribute('data-tooltip-id', _))
        : h.setAttribute('aria-describedby', _),
      ae || en(),
      T.init();
  }
  function Je(h) {
    return h in y ? y[h] : m().classList.contains(h);
  }
  function _t(h) {
    y[h] || t(10, (y[h] = !0), y);
  }
  function gt(h) {
    (!(h in y) || y[h]) && t(10, (y[h] = !1), y);
  }
  function Et(h, P) {
    N[h] != P && (P === '' || P == null ? (delete N[h], t(11, N)) : t(11, (N[h] = P), N));
  }
  function bt(h, P) {
    Le[h] != P && (P === '' || P == null ? (delete Le[h], t(13, Le)) : t(13, (Le[h] = P), Le));
  }
  function Fe(h) {
    var P;
    return h in Z ? ((P = Z[h]) !== null && P !== void 0 ? P : null) : m().getAttribute(h);
  }
  function rt(h, P) {
    Z[h] !== P && t(12, (Z[h] = P), Z);
  }
  function vt(h) {
    (!(h in Z) || Z[h] != null) && t(12, (Z[h] = void 0), Z);
  }
  function lt(h) {
    G.contains(h.relatedTarget) || (T && T.hide());
  }
  function R(h) {
    (h.type === 'keydown' && h.key !== 'Enter' && h.key !== ' ') || (T && T.handleAnchorClick());
  }
  function pe() {
    T && T.handleAnchorMouseEnter();
  }
  function Be(h) {
    T && T.handleAnchorFocus(h);
  }
  function It() {
    T && T.handleAnchorMouseLeave();
  }
  function Ht() {
    T && T.handleAnchorTouchstart();
  }
  function Lt() {
    T && T.handleAnchorTouchend();
  }
  function en() {
    var h, P;
    s &&
      document.body !== m().parentNode &&
      (O.setParent((h = m().parentElement) !== null && h !== void 0 ? h : void 0),
      O.setNextSibling((P = m().nextElementSibling) !== null && P !== void 0 ? P : void 0),
      document.body.appendChild(m()));
  }
  function tn(h) {
    T && T.attachScrollHandler(h);
  }
  function nn(h) {
    T && T.removeScrollHandler(h);
  }
  function m() {
    return G;
  }
  function B(h) {
    fe[h ? 'unshift' : 'push'](() => {
      (G = h), t(9, G);
    });
  }
  const ce = () => T && T.handleTransitionEnd();
  return (
    (n.$$set = (h) => {
      (e = F(F({}, e), Ge(h))),
        t(19, (a = re(e, i))),
        'use' in h && t(0, (c = h.use)),
        'class' in h && t(1, (f = h.class)),
        'style' in h && t(2, (g = h.style)),
        'id' in h && t(3, (_ = h.id)),
        'unbounded' in h && t(20, (E = h.unbounded)),
        'xPos' in h && t(21, (p = h.xPos)),
        'yPos' in h && t(22, (v = h.yPos)),
        'persistent' in h && t(4, (A = h.persistent)),
        'interactive' in h && t(23, (H = h.interactive)),
        'hideFromScreenreader' in h && t(5, (b = h.hideFromScreenreader)),
        'showDelay' in h && t(24, (C = h.showDelay)),
        'hideDelay' in h && t(25, (k = h.hideDelay)),
        'surface$class' in h && t(6, (S = h.surface$class)),
        'surface$style' in h && t(7, (W = h.surface$style)),
        '$$scope' in h && t(31, (u = h.$$scope));
    }),
    (n.$$.update = () => {
      n.$$.dirty[0] & 8388624 &&
        t(14, (r = { role: ae && H ? 'dialog' : 'tooltip', tabindex: ae && A ? -1 : void 0 })),
        n.$$.dirty[0] & 1610612992 && T && M !== s && (M && ge(M), s && qe(s), t(29, (M = s))),
        n.$$.dirty[0] & 1048832 && T && T.setAnchorBoundaryType(Yt[E ? 'UNBOUNDED' : 'BOUNDED']),
        n.$$.dirty[0] & 6291712 &&
          T &&
          T.setTooltipPosition({ xPos: st[p.toUpperCase()], yPos: pt[v.toUpperCase()] }),
        n.$$.dirty[0] & 16777472 && T && C != null && T.setShowDelay(C),
        n.$$.dirty[0] & 33554688 && T && k != null && T.setHideDelay(k);
    }),
    [
      c,
      f,
      g,
      _,
      A,
      b,
      S,
      W,
      T,
      G,
      y,
      N,
      Z,
      Le,
      r,
      d,
      We,
      Pe,
      ae,
      a,
      E,
      p,
      v,
      H,
      C,
      k,
      tn,
      nn,
      m,
      M,
      s,
      u,
      l,
      B,
      ce,
    ]
  );
}
class wt extends Ie {
  constructor(e) {
    super(),
      we(
        this,
        e,
        Kr,
        zr,
        _e,
        {
          use: 0,
          class: 1,
          style: 2,
          id: 3,
          unbounded: 20,
          xPos: 21,
          yPos: 22,
          persistent: 4,
          interactive: 23,
          hideFromScreenreader: 5,
          showDelay: 24,
          hideDelay: 25,
          surface$class: 6,
          surface$style: 7,
          attachScrollHandler: 26,
          removeScrollHandler: 27,
          getElement: 28,
        },
        null,
        [-1, -1]
      );
  }
  get attachScrollHandler() {
    return this.$$.ctx[26];
  }
  get removeScrollHandler() {
    return this.$$.ctx[27];
  }
  get getElement() {
    return this.$$.ctx[28];
  }
}
function qr(n) {
  let e;
  const t = n[12].default,
    r = Ee(t, n, n[11], null);
  return {
    c() {
      r && r.c();
    },
    m(i, a) {
      r && r.m(i, a), (e = !0);
    },
    p(i, a) {
      r &&
        r.p &&
        (!e || a & 2048) &&
        ve(r, t, i, i[11], e ? be(t, i[11], a, null) : Ae(i[11]), null);
    },
    i(i) {
      e || (w(r, i), (e = !0));
    },
    o(i) {
      L(r, i), (e = !1);
    },
    d(i) {
      r && r.d(i);
    },
  };
}
function Xr(n) {
  let e, t, r, i, a, s;
  const o = n[12].default,
    l = Ee(o, n, n[11], null);
  let u = [{ class: (t = x({ [n[1]]: !0, 'mdc-tooltip-wrapper--rich': !0 })) }, n[7]],
    d = {};
  for (let c = 0; c < u.length; c += 1) d = F(d, u[c]);
  return {
    c() {
      (e = J('div')), l && l.c(), te(e, d);
    },
    m(c, f) {
      I(c, e, f),
        l && l.m(e, null),
        n[13](e),
        (i = !0),
        a || ((s = [ee((r = De.call(null, e, n[0]))), ee(n[4].call(null, e))]), (a = !0));
    },
    p(c, f) {
      l &&
        l.p &&
        (!i || f & 2048) &&
        ve(l, o, c, c[11], i ? be(o, c[11], f, null) : Ae(c[11]), null),
        te(
          e,
          (d = le(u, [
            (!i || (f & 2 && t !== (t = x({ [c[1]]: !0, 'mdc-tooltip-wrapper--rich': !0 })))) && {
              class: t,
            },
            f & 128 && c[7],
          ]))
        ),
        r && me(r.update) && f & 1 && r.update.call(null, c[0]);
    },
    i(c) {
      i || (w(l, c), (i = !0));
    },
    o(c) {
      L(l, c), (i = !1);
    },
    d(c) {
      c && D(e), l && l.d(c), n[13](null), (a = !1), he(s);
    },
  };
}
function Zr(n) {
  let e, t, r, i;
  const a = [Xr, qr],
    s = [];
  function o(l, u) {
    return l[2] ? 0 : 1;
  }
  return (
    (e = o(n)),
    (t = s[e] = a[e](n)),
    {
      c() {
        t.c(), (r = Ve());
      },
      m(l, u) {
        s[e].m(l, u), I(l, r, u), (i = !0);
      },
      p(l, [u]) {
        let d = e;
        (e = o(l)),
          e === d
            ? s[e].p(l, u)
            : (et(),
              L(s[d], 1, 1, () => {
                s[d] = null;
              }),
              tt(),
              (t = s[e]),
              t ? t.p(l, u) : ((t = s[e] = a[e](l)), t.c()),
              w(t, 1),
              t.m(r.parentNode, r));
      },
      i(l) {
        i || (w(t), (i = !0));
      },
      o(l) {
        L(t), (i = !1);
      },
      d(l) {
        l && D(r), s[e].d(l);
      },
    }
  );
}
function Qr(n, e, t) {
  const r = ['use', 'class', 'rich', 'getElement'];
  let i = re(e, r),
    a,
    s,
    { $$slots: o = {}, $$scope: l } = e;
  const u = ze(Ce());
  let { use: d = [] } = e,
    { class: c = '' } = e,
    { rich: f = !1 } = e,
    g;
  const _ = Ct(void 0);
  Qe(n, _, (A) => t(10, (s = A)));
  const E = Ct(void 0);
  Qe(n, E, (A) => t(9, (a = A))),
    de('SMUI:tooltip:wrapper:anchor', _),
    de('SMUI:tooltip:wrapper:tooltip', E),
    de('SMUI:tooltip:rich', f);
  function p() {
    return g;
  }
  function v(A) {
    fe[A ? 'unshift' : 'push'](() => {
      (g = A), t(3, g);
    });
  }
  return (
    (n.$$set = (A) => {
      (e = F(F({}, e), Ge(A))),
        t(7, (i = re(e, r))),
        'use' in A && t(0, (d = A.use)),
        'class' in A && t(1, (c = A.class)),
        'rich' in A && t(2, (f = A.rich)),
        '$$scope' in A && t(11, (l = A.$$scope));
    }),
    (n.$$.update = () => {
      n.$$.dirty & 1536 && a && !s && jt(_, (s = a.previousElementSibling), s);
    }),
    [d, c, f, g, u, _, E, i, p, a, s, l, o, v]
  );
}
class Tt extends Ie {
  constructor(e) {
    super(), we(this, e, Qr, Zr, _e, { use: 0, class: 1, rich: 2, getElement: 8 });
  }
  get getElement() {
    return this.$$.ctx[8];
  }
}
function Jr(n) {
  let e;
  const t = n[11].default,
    r = Ee(t, n, n[13], null);
  return {
    c() {
      r && r.c();
    },
    m(i, a) {
      r && r.m(i, a), (e = !0);
    },
    p(i, a) {
      r &&
        r.p &&
        (!e || a & 8192) &&
        ve(r, t, i, i[13], e ? be(t, i[13], a, null) : Ae(i[13]), null);
    },
    i(i) {
      e || (w(r, i), (e = !0));
    },
    o(i) {
      L(r, i), (e = !1);
    },
    d(i) {
      r && r.d(i);
    },
  };
}
function Yr(n) {
  let e, t, r;
  const i = [
    { tag: n[3] },
    { use: [n[8], ...n[0]] },
    { class: x({ [n[1]]: !0, [n[6]]: !0, ...n[5] }) },
    n[7],
    n[9],
  ];
  var a = n[2];
  function s(o, l) {
    let u = { $$slots: { default: [Jr] }, $$scope: { ctx: o } };
    for (let d = 0; d < i.length; d += 1) u = F(u, i[d]);
    return (
      l !== void 0 &&
        l & 1003 &&
        (u = F(
          u,
          le(i, [
            l & 8 && { tag: o[3] },
            l & 257 && { use: [o[8], ...o[0]] },
            l & 98 && { class: x({ [o[1]]: !0, [o[6]]: !0, ...o[5] }) },
            l & 128 && je(o[7]),
            l & 512 && je(o[9]),
          ])
        )),
      { props: u }
    );
  }
  return (
    a && ((e = Xt(a, s(n))), n[12](e)),
    {
      c() {
        e && K(e.$$.fragment), (t = Ve());
      },
      m(o, l) {
        e && z(e, o, l), I(o, t, l), (r = !0);
      },
      p(o, [l]) {
        if (l & 4 && a !== (a = o[2])) {
          if (e) {
            et();
            const u = e;
            L(u.$$.fragment, 1, 0, () => {
              j(u, 1);
            }),
              tt();
          }
          a
            ? ((e = Xt(a, s(o, l))),
              o[12](e),
              K(e.$$.fragment),
              w(e.$$.fragment, 1),
              z(e, t.parentNode, t))
            : (e = null);
        } else if (a) {
          const u =
            l & 1003
              ? le(i, [
                  l & 8 && { tag: o[3] },
                  l & 257 && { use: [o[8], ...o[0]] },
                  l & 98 && { class: x({ [o[1]]: !0, [o[6]]: !0, ...o[5] }) },
                  l & 128 && je(o[7]),
                  l & 512 && je(o[9]),
                ])
              : {};
          l & 8192 && (u.$$scope = { dirty: l, ctx: o }), e.$set(u);
        }
      },
      i(o) {
        r || (e && w(e.$$.fragment, o), (r = !0));
      },
      o(o) {
        e && L(e.$$.fragment, o), (r = !1);
      },
      d(o) {
        o && D(t), n[12](null), e && j(e, o);
      },
    }
  );
}
const Ze = { component: Jt, tag: 'div', class: '', classMap: {}, contexts: {}, props: {} };
function xr(n, e, t) {
  const r = ['use', 'class', 'component', 'tag', 'getElement'];
  let i = re(e, r),
    { $$slots: a = {}, $$scope: s } = e,
    { use: o = [] } = e,
    { class: l = '' } = e,
    u;
  const d = Ze.class,
    c = {},
    f = [],
    g = Ze.contexts,
    _ = Ze.props;
  let { component: E = Ze.component } = e,
    { tag: p = E === Jt ? Ze.tag : void 0 } = e;
  Object.entries(Ze.classMap).forEach(([b, C]) => {
    const k = ye(C);
    k &&
      'subscribe' in k &&
      f.push(
        k.subscribe((S) => {
          t(5, (c[b] = S), c);
        })
      );
  });
  const v = ze(Ce());
  for (let b in g) g.hasOwnProperty(b) && de(b, g[b]);
  xt(() => {
    for (const b of f) b();
  });
  function A() {
    return u.getElement();
  }
  function H(b) {
    fe[b ? 'unshift' : 'push'](() => {
      (u = b), t(4, u);
    });
  }
  return (
    (n.$$set = (b) => {
      (e = F(F({}, e), Ge(b))),
        t(9, (i = re(e, r))),
        'use' in b && t(0, (o = b.use)),
        'class' in b && t(1, (l = b.class)),
        'component' in b && t(2, (E = b.component)),
        'tag' in b && t(3, (p = b.tag)),
        '$$scope' in b && t(13, (s = b.$$scope));
    }),
    [o, l, E, p, u, c, d, _, v, i, A, a, H, s]
  );
}
class $r extends Ie {
  constructor(e) {
    super(), we(this, e, xr, Yr, _e, { use: 0, class: 1, component: 2, tag: 3, getElement: 10 });
  }
  get getElement() {
    return this.$$.ctx[10];
  }
}
const wn = Object.assign({}, Ze);
function $t(n) {
  return new Proxy($r, {
    construct: function (e, t) {
      return Object.assign(Ze, wn, n), new e(...t);
    },
    get: function (e, t) {
      return Object.assign(Ze, wn, n), e[t];
    },
  });
}
$t({ class: 'mdc-tooltip__title', tag: 'h2' });
$t({ class: 'mdc-tooltip__content', tag: 'div' });
$t({ class: 'mdc-tooltip__content-link', tag: 'a' });
$t({
  class: 'mdc-tooltip--rich-actions',
  tag: 'div',
  contexts: { 'SMUI:button:context': 'tooltip:rich-actions' },
});
function ei(n) {
  let e;
  return {
    c() {
      e = ne('menu');
    },
    m(t, r) {
      I(t, e, r);
    },
    d(t) {
      t && D(e);
    },
  };
}
function ti(n) {
  let e;
  return {
    c() {
      e = ne('note_add');
    },
    m(t, r) {
      I(t, e, r);
    },
    d(t) {
      t && D(e);
    },
  };
}
function ni(n) {
  let e;
  return {
    c() {
      e = ne('Commit changes');
    },
    m(t, r) {
      I(t, e, r);
    },
    d(t) {
      t && D(e);
    },
  };
}
function ri(n) {
  let e, t, r, i;
  return (
    (e = new mt({
      props: { class: 'material-icons', $$slots: { default: [ti] }, $$scope: { ctx: n } },
    })),
    (r = new wt({ props: { $$slots: { default: [ni] }, $$scope: { ctx: n } } })),
    {
      c() {
        K(e.$$.fragment), (t = Y()), K(r.$$.fragment);
      },
      m(a, s) {
        z(e, a, s), I(a, t, s), z(r, a, s), (i = !0);
      },
      p(a, s) {
        const o = {};
        s & 4 && (o.$$scope = { dirty: s, ctx: a }), e.$set(o);
        const l = {};
        s & 4 && (l.$$scope = { dirty: s, ctx: a }), r.$set(l);
      },
      i(a) {
        i || (w(e.$$.fragment, a), w(r.$$.fragment, a), (i = !0));
      },
      o(a) {
        L(e.$$.fragment, a), L(r.$$.fragment, a), (i = !1);
      },
      d(a) {
        a && D(t), j(e, a), j(r, a);
      },
    }
  );
}
function ii(n) {
  let e;
  return {
    c() {
      e = ne('cloud_download');
    },
    m(t, r) {
      I(t, e, r);
    },
    d(t) {
      t && D(e);
    },
  };
}
function ai(n) {
  let e;
  return {
    c() {
      e = ne('Pull from Remote');
    },
    m(t, r) {
      I(t, e, r);
    },
    d(t) {
      t && D(e);
    },
  };
}
function oi(n) {
  let e, t, r, i;
  return (
    (e = new mt({
      props: { class: 'material-icons', $$slots: { default: [ii] }, $$scope: { ctx: n } },
    })),
    (r = new wt({ props: { $$slots: { default: [ai] }, $$scope: { ctx: n } } })),
    {
      c() {
        K(e.$$.fragment), (t = Y()), K(r.$$.fragment);
      },
      m(a, s) {
        z(e, a, s), I(a, t, s), z(r, a, s), (i = !0);
      },
      p(a, s) {
        const o = {};
        s & 4 && (o.$$scope = { dirty: s, ctx: a }), e.$set(o);
        const l = {};
        s & 4 && (l.$$scope = { dirty: s, ctx: a }), r.$set(l);
      },
      i(a) {
        i || (w(e.$$.fragment, a), w(r.$$.fragment, a), (i = !0));
      },
      o(a) {
        L(e.$$.fragment, a), L(r.$$.fragment, a), (i = !1);
      },
      d(a) {
        a && D(t), j(e, a), j(r, a);
      },
    }
  );
}
function si(n) {
  let e;
  return {
    c() {
      e = ne('cloud_upload');
    },
    m(t, r) {
      I(t, e, r);
    },
    d(t) {
      t && D(e);
    },
  };
}
function li(n) {
  let e;
  return {
    c() {
      e = ne('Push to Remote');
    },
    m(t, r) {
      I(t, e, r);
    },
    d(t) {
      t && D(e);
    },
  };
}
function ui(n) {
  let e, t, r, i;
  return (
    (e = new mt({
      props: { class: 'material-icons', $$slots: { default: [si] }, $$scope: { ctx: n } },
    })),
    (r = new wt({ props: { $$slots: { default: [li] }, $$scope: { ctx: n } } })),
    {
      c() {
        K(e.$$.fragment), (t = Y()), K(r.$$.fragment);
      },
      m(a, s) {
        z(e, a, s), I(a, t, s), z(r, a, s), (i = !0);
      },
      p(a, s) {
        const o = {};
        s & 4 && (o.$$scope = { dirty: s, ctx: a }), e.$set(o);
        const l = {};
        s & 4 && (l.$$scope = { dirty: s, ctx: a }), r.$set(l);
      },
      i(a) {
        i || (w(e.$$.fragment, a), w(r.$$.fragment, a), (i = !0));
      },
      o(a) {
        L(e.$$.fragment, a), L(r.$$.fragment, a), (i = !1);
      },
      d(a) {
        a && D(t), j(e, a), j(r, a);
      },
    }
  );
}
function ci(n) {
  let e;
  return {
    c() {
      e = ne('cloud_sync');
    },
    m(t, r) {
      I(t, e, r);
    },
    d(t) {
      t && D(e);
    },
  };
}
function di(n) {
  let e;
  return {
    c() {
      e = ne('Fetch From Remote');
    },
    m(t, r) {
      I(t, e, r);
    },
    d(t) {
      t && D(e);
    },
  };
}
function fi(n) {
  let e, t, r, i;
  return (
    (e = new mt({
      props: { class: 'material-icons', $$slots: { default: [ci] }, $$scope: { ctx: n } },
    })),
    e.$on('click', n[0]),
    (r = new wt({ props: { $$slots: { default: [di] }, $$scope: { ctx: n } } })),
    {
      c() {
        K(e.$$.fragment), (t = Y()), K(r.$$.fragment);
      },
      m(a, s) {
        z(e, a, s), I(a, t, s), z(r, a, s), (i = !0);
      },
      p(a, s) {
        const o = {};
        s & 4 && (o.$$scope = { dirty: s, ctx: a }), e.$set(o);
        const l = {};
        s & 4 && (l.$$scope = { dirty: s, ctx: a }), r.$set(l);
      },
      i(a) {
        i || (w(e.$$.fragment, a), w(r.$$.fragment, a), (i = !0));
      },
      o(a) {
        L(e.$$.fragment, a), L(r.$$.fragment, a), (i = !1);
      },
      d(a) {
        a && D(t), j(e, a), j(r, a);
      },
    }
  );
}
function hi(n) {
  let e;
  return {
    c() {
      e = ne('settings');
    },
    m(t, r) {
      I(t, e, r);
    },
    d(t) {
      t && D(e);
    },
  };
}
function pi(n) {
  let e;
  return {
    c() {
      e = ne('Settings');
    },
    m(t, r) {
      I(t, e, r);
    },
    d(t) {
      t && D(e);
    },
  };
}
function mi(n) {
  let e, t, r, i;
  return (
    (e = new mt({
      props: { class: 'material-icons', $$slots: { default: [hi] }, $$scope: { ctx: n } },
    })),
    (r = new wt({ props: { $$slots: { default: [pi] }, $$scope: { ctx: n } } })),
    {
      c() {
        K(e.$$.fragment), (t = Y()), K(r.$$.fragment);
      },
      m(a, s) {
        z(e, a, s), I(a, t, s), z(r, a, s), (i = !0);
      },
      p(a, s) {
        const o = {};
        s & 4 && (o.$$scope = { dirty: s, ctx: a }), e.$set(o);
        const l = {};
        s & 4 && (l.$$scope = { dirty: s, ctx: a }), r.$set(l);
      },
      i(a) {
        i || (w(e.$$.fragment, a), w(r.$$.fragment, a), (i = !0));
      },
      o(a) {
        L(e.$$.fragment, a), L(r.$$.fragment, a), (i = !1);
      },
      d(a) {
        a && D(t), j(e, a), j(r, a);
      },
    }
  );
}
function _i(n) {
  let e, t, r, i, a, s, o, l, u, d, c, f, g, _, E;
  return (
    (e = new mt({
      props: { class: 'material-icons', $$slots: { default: [ei] }, $$scope: { ctx: n } },
    })),
    (s = new Tt({ props: { $$slots: { default: [ri] }, $$scope: { ctx: n } } })),
    (l = new Tt({ props: { $$slots: { default: [oi] }, $$scope: { ctx: n } } })),
    (d = new Tt({ props: { $$slots: { default: [ui] }, $$scope: { ctx: n } } })),
    (f = new Tt({ props: { $$slots: { default: [fi] }, $$scope: { ctx: n } } })),
    (_ = new Tt({ props: { $$slots: { default: [mi] }, $$scope: { ctx: n } } })),
    {
      c() {
        K(e.$$.fragment),
          (t = Y()),
          (r = J('h2')),
          (r.textContent = 'Guito'),
          (i = Y()),
          (a = J('div')),
          K(s.$$.fragment),
          (o = Y()),
          K(l.$$.fragment),
          (u = Y()),
          K(d.$$.fragment),
          (c = Y()),
          K(f.$$.fragment),
          (g = Y()),
          K(_.$$.fragment),
          Q(a, 'class', 'right-toolbar svelte-1uf5b57');
      },
      m(p, v) {
        z(e, p, v),
          I(p, t, v),
          I(p, r, v),
          I(p, i, v),
          I(p, a, v),
          z(s, a, null),
          $(a, o),
          z(l, a, null),
          $(a, u),
          z(d, a, null),
          $(a, c),
          z(f, a, null),
          $(a, g),
          z(_, a, null),
          (E = !0);
      },
      p(p, [v]) {
        const A = {};
        v & 4 && (A.$$scope = { dirty: v, ctx: p }), e.$set(A);
        const H = {};
        v & 4 && (H.$$scope = { dirty: v, ctx: p }), s.$set(H);
        const b = {};
        v & 4 && (b.$$scope = { dirty: v, ctx: p }), l.$set(b);
        const C = {};
        v & 4 && (C.$$scope = { dirty: v, ctx: p }), d.$set(C);
        const k = {};
        v & 4 && (k.$$scope = { dirty: v, ctx: p }), f.$set(k);
        const S = {};
        v & 4 && (S.$$scope = { dirty: v, ctx: p }), _.$set(S);
      },
      i(p) {
        E ||
          (w(e.$$.fragment, p),
          w(s.$$.fragment, p),
          w(l.$$.fragment, p),
          w(d.$$.fragment, p),
          w(f.$$.fragment, p),
          w(_.$$.fragment, p),
          (E = !0));
      },
      o(p) {
        L(e.$$.fragment, p),
          L(s.$$.fragment, p),
          L(l.$$.fragment, p),
          L(d.$$.fragment, p),
          L(f.$$.fragment, p),
          L(_.$$.fragment, p),
          (E = !1);
      },
      d(p) {
        p && (D(t), D(r), D(i), D(a)), j(e, p), j(s), j(l), j(d), j(f), j(_);
      },
    }
  );
}
function gi(n, e, t) {
  let { loadData: r } = e;
  async function i() {
    (await fetch('http://localhost:8080/api/fetch', { method: 'GET' })).ok && (await r());
  }
  return (
    (n.$$set = (a) => {
      'loadData' in a && t(1, (r = a.loadData));
    }),
    [i, r]
  );
}
class Ei extends Ie {
  constructor(e) {
    super(), we(this, e, gi, _i, _e, { loadData: 1 });
  }
}
/**
 * @license
 * Copyright 2019 Google Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */ var oe = {
    CELL: 'mdc-data-table__cell',
    CELL_NUMERIC: 'mdc-data-table__cell--numeric',
    CONTENT: 'mdc-data-table__content',
    HEADER_CELL: 'mdc-data-table__header-cell',
    HEADER_CELL_LABEL: 'mdc-data-table__header-cell-label',
    HEADER_CELL_SORTED: 'mdc-data-table__header-cell--sorted',
    HEADER_CELL_SORTED_DESCENDING: 'mdc-data-table__header-cell--sorted-descending',
    HEADER_CELL_WITH_SORT: 'mdc-data-table__header-cell--with-sort',
    HEADER_CELL_WRAPPER: 'mdc-data-table__header-cell-wrapper',
    HEADER_ROW: 'mdc-data-table__header-row',
    HEADER_ROW_CHECKBOX: 'mdc-data-table__header-row-checkbox',
    IN_PROGRESS: 'mdc-data-table--in-progress',
    LINEAR_PROGRESS: 'mdc-data-table__linear-progress',
    PAGINATION_ROWS_PER_PAGE_LABEL: 'mdc-data-table__pagination-rows-per-page-label',
    PAGINATION_ROWS_PER_PAGE_SELECT: 'mdc-data-table__pagination-rows-per-page-select',
    PROGRESS_INDICATOR: 'mdc-data-table__progress-indicator',
    ROOT: 'mdc-data-table',
    ROW: 'mdc-data-table__row',
    ROW_CHECKBOX: 'mdc-data-table__row-checkbox',
    ROW_SELECTED: 'mdc-data-table__row--selected',
    SORT_ICON_BUTTON: 'mdc-data-table__sort-icon-button',
    SORT_STATUS_LABEL: 'mdc-data-table__sort-status-label',
    TABLE_CONTAINER: 'mdc-data-table__table-container',
  },
  In = { ARIA_SELECTED: 'aria-selected', ARIA_SORT: 'aria-sort' },
  bi = { COLUMN_ID: 'data-column-id', ROW_ID: 'data-row-id' },
  Gt = {
    CONTENT: '.' + oe.CONTENT,
    HEADER_CELL: '.' + oe.HEADER_CELL,
    HEADER_CELL_WITH_SORT: '.' + oe.HEADER_CELL_WITH_SORT,
    HEADER_ROW: '.' + oe.HEADER_ROW,
    HEADER_ROW_CHECKBOX: '.' + oe.HEADER_ROW_CHECKBOX,
    PROGRESS_INDICATOR: '.' + oe.PROGRESS_INDICATOR,
    ROW: '.' + oe.ROW,
    ROW_CHECKBOX: '.' + oe.ROW_CHECKBOX,
    ROW_SELECTED: '.' + oe.ROW_SELECTED,
    SORT_ICON_BUTTON: '.' + oe.SORT_ICON_BUTTON,
    SORT_STATUS_LABEL: '.' + oe.SORT_STATUS_LABEL,
  },
  it = {
    ARIA_SELECTED: In.ARIA_SELECTED,
    ARIA_SORT: In.ARIA_SORT,
    DATA_ROW_ID_ATTR: bi.ROW_ID,
    HEADER_ROW_CHECKBOX_SELECTOR: Gt.HEADER_ROW_CHECKBOX,
    ROW_CHECKBOX_SELECTOR: Gt.ROW_CHECKBOX,
    ROW_SELECTED_SELECTOR: Gt.ROW_SELECTED,
    ROW_SELECTOR: Gt.ROW,
  },
  ke;
(function (n) {
  (n.ASCENDING = 'ascending'),
    (n.DESCENDING = 'descending'),
    (n.NONE = 'none'),
    (n.OTHER = 'other');
})(ke || (ke = {}));
/**
 * @license
 * Copyright 2019 Google Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */ var vi = (function (n) {
  Rt(e, n);
  function e(t) {
    return n.call(this, Me(Me({}, e.defaultAdapter), t)) || this;
  }
  return (
    Object.defineProperty(e, 'defaultAdapter', {
      get: function () {
        return {
          addClass: function () {},
          addClassAtRowIndex: function () {},
          getAttributeByHeaderCellIndex: function () {
            return '';
          },
          getHeaderCellCount: function () {
            return 0;
          },
          getHeaderCellElements: function () {
            return [];
          },
          getRowCount: function () {
            return 0;
          },
          getRowElements: function () {
            return [];
          },
          getRowIdAtIndex: function () {
            return '';
          },
          getRowIndexByChildElement: function () {
            return 0;
          },
          getSelectedRowCount: function () {
            return 0;
          },
          getTableContainerHeight: function () {
            return 0;
          },
          getTableHeaderHeight: function () {
            return 0;
          },
          isCheckboxAtRowIndexChecked: function () {
            return !1;
          },
          isHeaderRowCheckboxChecked: function () {
            return !1;
          },
          isRowsSelectable: function () {
            return !1;
          },
          notifyRowSelectionChanged: function () {},
          notifySelectedAll: function () {},
          notifySortAction: function () {},
          notifyUnselectedAll: function () {},
          notifyRowClick: function () {},
          registerHeaderRowCheckbox: function () {},
          registerRowCheckboxes: function () {},
          removeClass: function () {},
          removeClassAtRowIndex: function () {},
          removeClassNameByHeaderCellIndex: function () {},
          setAttributeAtRowIndex: function () {},
          setAttributeByHeaderCellIndex: function () {},
          setClassNameByHeaderCellIndex: function () {},
          setHeaderRowCheckboxChecked: function () {},
          setHeaderRowCheckboxIndeterminate: function () {},
          setProgressIndicatorStyles: function () {},
          setRowCheckboxCheckedAtIndex: function () {},
          setSortStatusLabelByHeaderCellIndex: function () {},
        };
      },
      enumerable: !1,
      configurable: !0,
    }),
    (e.prototype.layout = function () {
      this.adapter.isRowsSelectable() &&
        (this.adapter.registerHeaderRowCheckbox(),
        this.adapter.registerRowCheckboxes(),
        this.setHeaderRowCheckboxState());
    }),
    (e.prototype.layoutAsync = function () {
      return ur(this, void 0, void 0, function () {
        return cr(this, function (t) {
          switch (t.label) {
            case 0:
              return this.adapter.isRowsSelectable()
                ? [4, this.adapter.registerHeaderRowCheckbox()]
                : [3, 3];
            case 1:
              return t.sent(), [4, this.adapter.registerRowCheckboxes()];
            case 2:
              t.sent(), this.setHeaderRowCheckboxState(), (t.label = 3);
            case 3:
              return [2];
          }
        });
      });
    }),
    (e.prototype.getRows = function () {
      return this.adapter.getRowElements();
    }),
    (e.prototype.getHeaderCells = function () {
      return this.adapter.getHeaderCellElements();
    }),
    (e.prototype.setSelectedRowIds = function (t) {
      for (var r = 0; r < this.adapter.getRowCount(); r++) {
        var i = this.adapter.getRowIdAtIndex(r),
          a = !1;
        i && t.indexOf(i) >= 0 && (a = !0),
          this.adapter.setRowCheckboxCheckedAtIndex(r, a),
          this.selectRowAtIndex(r, a);
      }
      this.setHeaderRowCheckboxState();
    }),
    (e.prototype.getRowIds = function () {
      for (var t = [], r = 0; r < this.adapter.getRowCount(); r++)
        t.push(this.adapter.getRowIdAtIndex(r));
      return t;
    }),
    (e.prototype.getSelectedRowIds = function () {
      for (var t = [], r = 0; r < this.adapter.getRowCount(); r++)
        this.adapter.isCheckboxAtRowIndexChecked(r) && t.push(this.adapter.getRowIdAtIndex(r));
      return t;
    }),
    (e.prototype.handleHeaderRowCheckboxChange = function () {
      for (
        var t = this.adapter.isHeaderRowCheckboxChecked(), r = 0;
        r < this.adapter.getRowCount();
        r++
      )
        this.adapter.setRowCheckboxCheckedAtIndex(r, t), this.selectRowAtIndex(r, t);
      t ? this.adapter.notifySelectedAll() : this.adapter.notifyUnselectedAll();
    }),
    (e.prototype.handleRowCheckboxChange = function (t) {
      var r = this.adapter.getRowIndexByChildElement(t.target);
      if (r !== -1) {
        var i = this.adapter.isCheckboxAtRowIndexChecked(r);
        this.selectRowAtIndex(r, i), this.setHeaderRowCheckboxState();
        var a = this.adapter.getRowIdAtIndex(r);
        this.adapter.notifyRowSelectionChanged({ rowId: a, rowIndex: r, selected: i });
      }
    }),
    (e.prototype.handleSortAction = function (t) {
      for (
        var r = t.columnId, i = t.columnIndex, a = t.headerCell, s = 0;
        s < this.adapter.getHeaderCellCount();
        s++
      )
        s !== i &&
          (this.adapter.removeClassNameByHeaderCellIndex(s, oe.HEADER_CELL_SORTED),
          this.adapter.removeClassNameByHeaderCellIndex(s, oe.HEADER_CELL_SORTED_DESCENDING),
          this.adapter.setAttributeByHeaderCellIndex(s, it.ARIA_SORT, ke.NONE),
          this.adapter.setSortStatusLabelByHeaderCellIndex(s, ke.NONE));
      this.adapter.setClassNameByHeaderCellIndex(i, oe.HEADER_CELL_SORTED);
      var o = this.adapter.getAttributeByHeaderCellIndex(i, it.ARIA_SORT),
        l = ke.NONE;
      o === ke.ASCENDING
        ? (this.adapter.setClassNameByHeaderCellIndex(i, oe.HEADER_CELL_SORTED_DESCENDING),
          this.adapter.setAttributeByHeaderCellIndex(i, it.ARIA_SORT, ke.DESCENDING),
          (l = ke.DESCENDING))
        : o === ke.DESCENDING
        ? (this.adapter.removeClassNameByHeaderCellIndex(i, oe.HEADER_CELL_SORTED_DESCENDING),
          this.adapter.setAttributeByHeaderCellIndex(i, it.ARIA_SORT, ke.ASCENDING),
          (l = ke.ASCENDING))
        : (this.adapter.setAttributeByHeaderCellIndex(i, it.ARIA_SORT, ke.ASCENDING),
          (l = ke.ASCENDING)),
        this.adapter.setSortStatusLabelByHeaderCellIndex(i, l),
        this.adapter.notifySortAction({ columnId: r, columnIndex: i, headerCell: a, sortValue: l });
    }),
    (e.prototype.handleRowClick = function (t) {
      var r = t.rowId,
        i = t.row;
      this.adapter.notifyRowClick({ rowId: r, row: i });
    }),
    (e.prototype.showProgress = function () {
      var t = this.adapter.getTableHeaderHeight(),
        r = this.adapter.getTableContainerHeight() - t,
        i = t;
      this.adapter.setProgressIndicatorStyles({ height: r + 'px', top: i + 'px' }),
        this.adapter.addClass(oe.IN_PROGRESS);
    }),
    (e.prototype.hideProgress = function () {
      this.adapter.removeClass(oe.IN_PROGRESS);
    }),
    (e.prototype.setHeaderRowCheckboxState = function () {
      this.adapter.getSelectedRowCount() === 0
        ? (this.adapter.setHeaderRowCheckboxChecked(!1),
          this.adapter.setHeaderRowCheckboxIndeterminate(!1))
        : this.adapter.getSelectedRowCount() === this.adapter.getRowCount()
        ? (this.adapter.setHeaderRowCheckboxChecked(!0),
          this.adapter.setHeaderRowCheckboxIndeterminate(!1))
        : (this.adapter.setHeaderRowCheckboxIndeterminate(!0),
          this.adapter.setHeaderRowCheckboxChecked(!1));
    }),
    (e.prototype.selectRowAtIndex = function (t, r) {
      r
        ? (this.adapter.addClassAtRowIndex(t, oe.ROW_SELECTED),
          this.adapter.setAttributeAtRowIndex(t, it.ARIA_SELECTED, 'true'))
        : (this.adapter.removeClassAtRowIndex(t, oe.ROW_SELECTED),
          this.adapter.setAttributeAtRowIndex(t, it.ARIA_SELECTED, 'false'));
    }),
    e
  );
})(Dt);
const Ai = (n) => ({}),
  Hn = (n) => ({}),
  Ti = (n) => ({}),
  Ln = (n) => ({});
function kn(n) {
  let e, t, r, i, a;
  const s = n[36].progress,
    o = Ee(s, n, n[35], Ln);
  return {
    c() {
      (e = J('div')),
        (t = J('div')),
        (r = Y()),
        o && o.c(),
        Q(t, 'class', 'mdc-data-table__scrim'),
        Q(e, 'class', 'mdc-data-table__progress-indicator'),
        Q(e, 'style', (i = Object.entries(n[13]).map(Nn).join(' ')));
    },
    m(l, u) {
      I(l, e, u), $(e, t), $(e, r), o && o.m(e, null), (a = !0);
    },
    p(l, u) {
      o && o.p && (!a || u[1] & 16) && ve(o, s, l, l[35], a ? be(s, l[35], u, Ti) : Ae(l[35]), Ln),
        (!a || (u[0] & 8192 && i !== (i = Object.entries(l[13]).map(Nn).join(' ')))) &&
          Q(e, 'style', i);
    },
    i(l) {
      a || (w(o, l), (a = !0));
    },
    o(l) {
      L(o, l), (a = !1);
    },
    d(l) {
      l && D(e), o && o.d(l);
    },
  };
}
function yi(n) {
  let e, t, r, i, a, s, o, l, u, d, c, f, g, _;
  const E = n[36].default,
    p = Ee(E, n, n[35], null);
  let v = [{ class: (i = x({ [n[6]]: !0, 'mdc-data-table__table': !0 })) }, ft(n[25], 'table$')],
    A = {};
  for (let T = 0; T < v.length; T += 1) A = F(A, v[T]);
  let H = [
      { class: (s = x({ [n[4]]: !0, 'mdc-data-table__table-container': !0 })) },
      ft(n[25], 'container$'),
    ],
    b = {};
  for (let T = 0; T < H.length; T += 1) b = F(b, H[T]);
  let C = n[24].progress && kn(n);
  const k = n[36].paginate,
    S = Ee(k, n, n[35], Hn);
  let W = [
      {
        class: (d = x({
          [n[1]]: !0,
          'mdc-data-table': !0,
          'mdc-data-table--sticky-header': n[2],
          ...n[12],
        })),
      },
      Qt(n[25], ['container$', 'table$']),
    ],
    G = {};
  for (let T = 0; T < W.length; T += 1) G = F(G, W[T]);
  return {
    c() {
      (e = J('div')),
        (t = J('div')),
        (r = J('table')),
        p && p.c(),
        (l = Y()),
        C && C.c(),
        (u = Y()),
        S && S.c(),
        te(r, A),
        te(t, b),
        te(e, G);
    },
    m(T, O) {
      I(T, e, O),
        $(e, t),
        $(t, r),
        p && p.m(r, null),
        n[37](t),
        $(e, l),
        C && C.m(e, null),
        $(e, u),
        S && S.m(e, null),
        n[38](e),
        (f = !0),
        g ||
          ((_ = [
            ee((a = De.call(null, r, n[5]))),
            ee((o = De.call(null, t, n[3]))),
            ee((c = De.call(null, e, n[0]))),
            ee(n[15].call(null, e)),
            ie(e, 'SMUICheckbox:mount', n[39]),
            ie(e, 'SMUIDataTableHeader:mount', n[19]),
            ie(e, 'SMUIDataTableHeader:unmount', n[40]),
            ie(e, 'SMUIDataTableBody:mount', n[20]),
            ie(e, 'SMUIDataTableBody:unmount', n[41]),
            ie(e, 'SMUIDataTableHeaderCheckbox:change', n[42]),
            ie(e, 'SMUIDataTableHeader:click', n[22]),
            ie(e, 'SMUIDataTableRow:click', n[23]),
            ie(e, 'SMUIDataTableBodyCheckbox:change', n[21]),
          ]),
          (g = !0));
    },
    p(T, O) {
      p &&
        p.p &&
        (!f || O[1] & 16) &&
        ve(p, E, T, T[35], f ? be(E, T[35], O, null) : Ae(T[35]), null),
        te(
          r,
          (A = le(v, [
            (!f || (O[0] & 64 && i !== (i = x({ [T[6]]: !0, 'mdc-data-table__table': !0 })))) && {
              class: i,
            },
            O[0] & 33554432 && ft(T[25], 'table$'),
          ]))
        ),
        a && me(a.update) && O[0] & 32 && a.update.call(null, T[5]),
        te(
          t,
          (b = le(H, [
            (!f ||
              (O[0] & 16 &&
                s !== (s = x({ [T[4]]: !0, 'mdc-data-table__table-container': !0 })))) && {
              class: s,
            },
            O[0] & 33554432 && ft(T[25], 'container$'),
          ]))
        ),
        o && me(o.update) && O[0] & 8 && o.update.call(null, T[3]),
        T[24].progress
          ? C
            ? (C.p(T, O), O[0] & 16777216 && w(C, 1))
            : ((C = kn(T)), C.c(), w(C, 1), C.m(e, u))
          : C &&
            (et(),
            L(C, 1, 1, () => {
              C = null;
            }),
            tt()),
        S &&
          S.p &&
          (!f || O[1] & 16) &&
          ve(S, k, T, T[35], f ? be(k, T[35], O, Ai) : Ae(T[35]), Hn),
        te(
          e,
          (G = le(W, [
            (!f ||
              (O[0] & 4102 &&
                d !==
                  (d = x({
                    [T[1]]: !0,
                    'mdc-data-table': !0,
                    'mdc-data-table--sticky-header': T[2],
                    ...T[12],
                  })))) && { class: d },
            O[0] & 33554432 && Qt(T[25], ['container$', 'table$']),
          ]))
        ),
        c && me(c.update) && O[0] & 1 && c.update.call(null, T[0]);
    },
    i(T) {
      f || (w(p, T), w(C), w(S, T), (f = !0));
    },
    o(T) {
      L(p, T), L(C), L(S, T), (f = !1);
    },
    d(T) {
      T && D(e), p && p.d(T), n[37](null), C && C.d(), S && S.d(T), n[38](null), (g = !1), he(_);
    },
  };
}
const Nn = ([n, e]) => `${n}: ${e};`;
function Ci(n, e, t) {
  const r = [
    'use',
    'class',
    'stickyHeader',
    'sortable',
    'sort',
    'sortDirection',
    'sortAscendingAriaLabel',
    'sortDescendingAriaLabel',
    'container$use',
    'container$class',
    'table$use',
    'table$class',
    'layout',
    'getElement',
  ];
  let i = re(e, r),
    a,
    s,
    o,
    { $$slots: l = {}, $$scope: u } = e;
  const d = Qn(l),
    { closest: c } = zn,
    f = ze(Ce());
  let { use: g = [] } = e,
    { class: _ = '' } = e,
    { stickyHeader: E = !1 } = e,
    { sortable: p = !1 } = e,
    { sort: v = null } = e,
    { sortDirection: A = 'ascending' } = e,
    { sortAscendingAriaLabel: H = 'sorted, ascending' } = e,
    { sortDescendingAriaLabel: b = 'sorted, descending' } = e,
    { container$use: C = [] } = e,
    { container$class: k = '' } = e,
    { table$use: S = [] } = e,
    { table$class: W = '' } = e,
    G,
    T,
    O,
    y,
    N,
    Z = {},
    Le = { height: 'auto', top: 'initial' },
    We = ye('SMUI:addLayoutListener'),
    Pe,
    ae = !1,
    M = Ct(!1);
  Qe(n, M, (m) => t(34, (a = m)));
  let ge = Ct(v);
  Qe(n, ge, (m) => t(45, (o = m)));
  let qe = Ct(A);
  Qe(n, qe, (m) => t(44, (s = m))),
    de('SMUI:checkbox:context', 'data-table'),
    de('SMUI:linear-progress:context', 'data-table'),
    de('SMUI:linear-progress:closed', M),
    de('SMUI:data-table:sortable', p),
    de('SMUI:data-table:sort', ge),
    de('SMUI:data-table:sortDirection', qe),
    de('SMUI:data-table:sortAscendingAriaLabel', H),
    de('SMUI:data-table:sortDescendingAriaLabel', b),
    We && (Pe = We(pe));
  let Je;
  $e(
    () => (
      t(
        7,
        (T = new vi({
          addClass: bt,
          removeClass: Fe,
          getHeaderCellElements: () => {
            var m;
            return (m = y == null ? void 0 : y.cells.map((B) => B.element)) !== null && m !== void 0
              ? m
              : [];
          },
          getHeaderCellCount: () => {
            var m;
            return (m = y == null ? void 0 : y.cells.length) !== null && m !== void 0 ? m : 0;
          },
          getAttributeByHeaderCellIndex: (m, B) => {
            var ce;
            return (ce = y == null ? void 0 : y.orderedCells[m].getAttr(B)) !== null &&
              ce !== void 0
              ? ce
              : null;
          },
          setAttributeByHeaderCellIndex: (m, B, ce) => {
            y == null || y.orderedCells[m].addAttr(B, ce);
          },
          setClassNameByHeaderCellIndex: (m, B) => {
            y == null || y.orderedCells[m].addClass(B);
          },
          removeClassNameByHeaderCellIndex: (m, B) => {
            y == null || y.orderedCells[m].removeClass(B);
          },
          notifySortAction: (m) => {
            t(26, (v = m.columnId)),
              t(27, (A = m.sortValue)),
              se(Be(), 'SMUIDataTable:sorted', m, void 0, !0);
          },
          getTableContainerHeight: () => O.getBoundingClientRect().height,
          getTableHeaderHeight: () => {
            const m = Be().querySelector('.mdc-data-table__header-row');
            if (!m) throw new Error('MDCDataTable: Table header element not found.');
            return m.getBoundingClientRect().height;
          },
          setProgressIndicatorStyles: (m) => {
            t(13, (Le = m));
          },
          addClassAtRowIndex: (m, B) => {
            N == null || N.orderedRows[m].addClass(B);
          },
          getRowCount: () => {
            var m;
            return (m = N == null ? void 0 : N.rows.length) !== null && m !== void 0 ? m : 0;
          },
          getRowElements: () => {
            var m;
            return (m = N == null ? void 0 : N.rows.map((B) => B.element)) !== null && m !== void 0
              ? m
              : [];
          },
          getRowIdAtIndex: (m) => {
            var B;
            return (B = N == null ? void 0 : N.orderedRows[m].rowId) !== null && B !== void 0
              ? B
              : null;
          },
          getRowIndexByChildElement: (m) => {
            var B;
            return (B =
              N == null
                ? void 0
                : N.orderedRows.map((ce) => ce.element).indexOf(c(m, '.mdc-data-table__row'))) !==
              null && B !== void 0
              ? B
              : -1;
          },
          getSelectedRowCount: () => {
            var m;
            return (m = N == null ? void 0 : N.rows.filter((B) => B.selected).length) !== null &&
              m !== void 0
              ? m
              : 0;
          },
          isCheckboxAtRowIndexChecked: (m) => {
            const B = N == null ? void 0 : N.orderedRows[m].checkbox;
            return B ? B.checked : !1;
          },
          isHeaderRowCheckboxChecked: () => {
            const m = y == null ? void 0 : y.checkbox;
            return m ? m.checked : !1;
          },
          isRowsSelectable: () =>
            !!Be().querySelector('.mdc-data-table__row-checkbox') ||
            !!Be().querySelector('.mdc-data-table__header-row-checkbox'),
          notifyRowSelectionChanged: (m) => {
            const B = N == null ? void 0 : N.orderedRows[m.rowIndex];
            B &&
              se(
                Be(),
                'SMUIDataTable:rowSelectionChanged',
                { row: B.element, rowId: B.rowId, rowIndex: m.rowIndex, selected: m.selected },
                void 0,
                !0
              );
          },
          notifySelectedAll: () => {
            rt(!1), se(Be(), 'SMUIDataTable:selectedAll', void 0, void 0, !0);
          },
          notifyUnselectedAll: () => {
            rt(!1), se(Be(), 'SMUIDataTable:unselectedAll', void 0, void 0, !0);
          },
          notifyRowClick: (m) => {
            se(Be(), 'SMUIDataTable:rowClick', m, void 0, !0);
          },
          registerHeaderRowCheckbox: () => {},
          registerRowCheckboxes: () => {},
          removeClassAtRowIndex: (m, B) => {
            N == null || N.orderedRows[m].removeClass(B);
          },
          setAttributeAtRowIndex: (m, B, ce) => {
            N == null || N.orderedRows[m].addAttr(B, ce);
          },
          setHeaderRowCheckboxChecked: (m) => {
            const B = y == null ? void 0 : y.checkbox;
            B && (B.checked = m);
          },
          setHeaderRowCheckboxIndeterminate: rt,
          setRowCheckboxCheckedAtIndex: (m, B) => {
            const ce = N == null ? void 0 : N.orderedRows[m].checkbox;
            ce && (ce.checked = B);
          },
          setSortStatusLabelByHeaderCellIndex: (m, B) => {},
        }))
      ),
      T.init(),
      T.layout(),
      t(14, (ae = !0)),
      () => {
        T.destroy();
      }
    )
  ),
    xt(() => {
      Pe && Pe();
    });
  function _t(m) {
    t(10, (y = m.detail));
  }
  function gt(m) {
    t(11, (N = m.detail));
  }
  function Et(m) {
    T && T.handleRowCheckboxChange(m);
  }
  function bt(m) {
    Z[m] || t(12, (Z[m] = !0), Z);
  }
  function Fe(m) {
    (!(m in Z) || Z[m]) && t(12, (Z[m] = !1), Z);
  }
  function rt(m) {
    const B = y == null ? void 0 : y.checkbox;
    B && (B.indeterminate = m);
  }
  function vt(m) {
    if (!T || !m.detail.target) return;
    const B = c(m.detail.target, '.mdc-data-table__header-cell--with-sort');
    B && R(B);
  }
  function lt(m) {
    if (!T || !m.detail.target) return;
    const B = c(m.detail.target, '.mdc-data-table__row');
    B && T && T.handleRowClick({ rowId: m.detail.rowId, row: B });
  }
  function R(m) {
    var B, ce;
    const h = (B = y == null ? void 0 : y.orderedCells) !== null && B !== void 0 ? B : [],
      P = h.map((kt) => kt.element).indexOf(m);
    if (P === -1) return;
    const Ye = (ce = h[P].columnId) !== null && ce !== void 0 ? ce : null;
    T.handleSortAction({ columnId: Ye, columnIndex: P, headerCell: m });
  }
  function pe() {
    return T.layout();
  }
  function Be() {
    return G;
  }
  function It(m) {
    fe[m ? 'unshift' : 'push'](() => {
      (O = m), t(9, O);
    });
  }
  function Ht(m) {
    fe[m ? 'unshift' : 'push'](() => {
      (G = m), t(8, G);
    });
  }
  const Lt = () => T && ae && T.layout(),
    en = () => t(10, (y = void 0)),
    tn = () => t(11, (N = void 0)),
    nn = () => T && T.handleHeaderRowCheckboxChange();
  return (
    (n.$$set = (m) => {
      (e = F(F({}, e), Ge(m))),
        t(25, (i = re(e, r))),
        'use' in m && t(0, (g = m.use)),
        'class' in m && t(1, (_ = m.class)),
        'stickyHeader' in m && t(2, (E = m.stickyHeader)),
        'sortable' in m && t(28, (p = m.sortable)),
        'sort' in m && t(26, (v = m.sort)),
        'sortDirection' in m && t(27, (A = m.sortDirection)),
        'sortAscendingAriaLabel' in m && t(29, (H = m.sortAscendingAriaLabel)),
        'sortDescendingAriaLabel' in m && t(30, (b = m.sortDescendingAriaLabel)),
        'container$use' in m && t(3, (C = m.container$use)),
        'container$class' in m && t(4, (k = m.container$class)),
        'table$use' in m && t(5, (S = m.table$use)),
        'table$class' in m && t(6, (W = m.table$class)),
        '$$scope' in m && t(35, (u = m.$$scope));
    }),
    (n.$$.update = () => {
      n.$$.dirty[0] & 67108864 && jt(ge, (o = v), o),
        n.$$.dirty[0] & 134217728 && jt(qe, (s = A), s),
        (n.$$.dirty[0] & 128) | (n.$$.dirty[1] & 12) &&
          d.progress &&
          T &&
          Je !== a &&
          (t(33, (Je = a)), a ? T.hideProgress() : T.showProgress());
    }),
    [
      g,
      _,
      E,
      C,
      k,
      S,
      W,
      T,
      G,
      O,
      y,
      N,
      Z,
      Le,
      ae,
      f,
      M,
      ge,
      qe,
      _t,
      gt,
      Et,
      vt,
      lt,
      d,
      i,
      v,
      A,
      p,
      H,
      b,
      pe,
      Be,
      Je,
      a,
      u,
      l,
      It,
      Ht,
      Lt,
      en,
      tn,
      nn,
    ]
  );
}
class Si extends Ie {
  constructor(e) {
    super(),
      we(
        this,
        e,
        Ci,
        yi,
        _e,
        {
          use: 0,
          class: 1,
          stickyHeader: 2,
          sortable: 28,
          sort: 26,
          sortDirection: 27,
          sortAscendingAriaLabel: 29,
          sortDescendingAriaLabel: 30,
          container$use: 3,
          container$class: 4,
          table$use: 5,
          table$class: 6,
          layout: 31,
          getElement: 32,
        },
        null,
        [-1, -1]
      );
  }
  get layout() {
    return this.$$.ctx[31];
  }
  get getElement() {
    return this.$$.ctx[32];
  }
}
function Oi(n) {
  let e, t, r, i, a;
  const s = n[10].default,
    o = Ee(s, n, n[9], null);
  let l = [n[7]],
    u = {};
  for (let d = 0; d < l.length; d += 1) u = F(u, l[d]);
  return {
    c() {
      (e = J('thead')), o && o.c(), te(e, u);
    },
    m(d, c) {
      I(d, e, c),
        o && o.m(e, null),
        n[11](e),
        (r = !0),
        i ||
          ((a = [
            ee((t = De.call(null, e, n[0]))),
            ee(n[3].call(null, e)),
            ie(e, 'SMUICheckbox:mount', n[4]),
            ie(e, 'SMUICheckbox:unmount', n[12]),
            ie(e, 'SMUIDataTableCell:mount', n[5]),
            ie(e, 'SMUIDataTableCell:unmount', n[6]),
          ]),
          (i = !0));
    },
    p(d, [c]) {
      o && o.p && (!r || c & 512) && ve(o, s, d, d[9], r ? be(s, d[9], c, null) : Ae(d[9]), null),
        te(e, (u = le(l, [c & 128 && d[7]]))),
        t && me(t.update) && c & 1 && t.update.call(null, d[0]);
    },
    i(d) {
      r || (w(o, d), (r = !0));
    },
    o(d) {
      L(o, d), (r = !1);
    },
    d(d) {
      d && D(e), o && o.d(d), n[11](null), (i = !1), he(a);
    },
  };
}
function Ri(n, e, t) {
  const r = ['use', 'getElement'];
  let i = re(e, r),
    { $$slots: a = {}, $$scope: s } = e;
  const o = ze(Ce());
  let { use: l = [] } = e,
    u,
    d,
    c = [];
  const f = new WeakMap();
  de('SMUI:data-table:row:header', !0),
    $e(() => {
      const b = {
        get cells() {
          return c;
        },
        get orderedCells() {
          return p();
        },
        get checkbox() {
          return d;
        },
      };
      return (
        se(v(), 'SMUIDataTableHeader:mount', b),
        () => {
          se(v(), 'SMUIDataTableHeader:unmount', b);
        }
      );
    });
  function g(b) {
    t(2, (d = b.detail));
  }
  function _(b) {
    c.push(b.detail), f.set(b.detail.element, b.detail), b.stopPropagation();
  }
  function E(b) {
    const C = c.indexOf(b.detail);
    C !== -1 && (c.splice(C, 1), (c = c)), f.delete(b.detail.element), b.stopPropagation();
  }
  function p() {
    return [...v().querySelectorAll('.mdc-data-table__header-cell')]
      .map((b) => f.get(b))
      .filter((b) => b && b._smui_data_table_header_cell_accessor);
  }
  function v() {
    return u;
  }
  function A(b) {
    fe[b ? 'unshift' : 'push'](() => {
      (u = b), t(1, u);
    });
  }
  const H = () => t(2, (d = void 0));
  return (
    (n.$$set = (b) => {
      (e = F(F({}, e), Ge(b))),
        t(7, (i = re(e, r))),
        'use' in b && t(0, (l = b.use)),
        '$$scope' in b && t(9, (s = b.$$scope));
    }),
    [l, u, d, o, g, _, E, i, v, s, a, A, H]
  );
}
class Di extends Ie {
  constructor(e) {
    super(), we(this, e, Ri, Oi, _e, { use: 0, getElement: 8 });
  }
  get getElement() {
    return this.$$.ctx[8];
  }
}
function wi(n) {
  let e, t, r, i, a, s;
  const o = n[9].default,
    l = Ee(o, n, n[8], null);
  let u = [{ class: (t = x({ [n[1]]: !0, 'mdc-data-table__content': !0 })) }, n[6]],
    d = {};
  for (let c = 0; c < u.length; c += 1) d = F(d, u[c]);
  return {
    c() {
      (e = J('tbody')), l && l.c(), te(e, d);
    },
    m(c, f) {
      I(c, e, f),
        l && l.m(e, null),
        n[10](e),
        (i = !0),
        a ||
          ((s = [
            ee((r = De.call(null, e, n[0]))),
            ee(n[3].call(null, e)),
            ie(e, 'SMUIDataTableRow:mount', n[4]),
            ie(e, 'SMUIDataTableRow:unmount', n[5]),
          ]),
          (a = !0));
    },
    p(c, [f]) {
      l && l.p && (!i || f & 256) && ve(l, o, c, c[8], i ? be(o, c[8], f, null) : Ae(c[8]), null),
        te(
          e,
          (d = le(u, [
            (!i || (f & 2 && t !== (t = x({ [c[1]]: !0, 'mdc-data-table__content': !0 })))) && {
              class: t,
            },
            f & 64 && c[6],
          ]))
        ),
        r && me(r.update) && f & 1 && r.update.call(null, c[0]);
    },
    i(c) {
      i || (w(l, c), (i = !0));
    },
    o(c) {
      L(l, c), (i = !1);
    },
    d(c) {
      c && D(e), l && l.d(c), n[10](null), (a = !1), he(s);
    },
  };
}
function Ii(n, e, t) {
  const r = ['use', 'class', 'getElement'];
  let i = re(e, r),
    { $$slots: a = {}, $$scope: s } = e;
  const o = ze(Ce());
  let { use: l = [] } = e,
    { class: u = '' } = e,
    d,
    c = [];
  const f = new WeakMap();
  de('SMUI:data-table:row:header', !1),
    $e(() => {
      const A = {
        get rows() {
          return c;
        },
        get orderedRows() {
          return E();
        },
      };
      return (
        se(p(), 'SMUIDataTableBody:mount', A),
        () => {
          se(p(), 'SMUIDataTableBody:unmount', A);
        }
      );
    });
  function g(A) {
    c.push(A.detail), f.set(A.detail.element, A.detail), A.stopPropagation();
  }
  function _(A) {
    const H = c.indexOf(A.detail);
    H !== -1 && (c.splice(H, 1), (c = c)), f.delete(A.detail.element), A.stopPropagation();
  }
  function E() {
    return [...p().querySelectorAll('.mdc-data-table__row')]
      .map((A) => f.get(A))
      .filter((A) => A && A._smui_data_table_row_accessor);
  }
  function p() {
    return d;
  }
  function v(A) {
    fe[A ? 'unshift' : 'push'](() => {
      (d = A), t(2, d);
    });
  }
  return (
    (n.$$set = (A) => {
      (e = F(F({}, e), Ge(A))),
        t(6, (i = re(e, r))),
        'use' in A && t(0, (l = A.use)),
        'class' in A && t(1, (u = A.class)),
        '$$scope' in A && t(8, (s = A.$$scope));
    }),
    [l, u, d, o, g, _, i, p, s, a, v]
  );
}
class Hi extends Ie {
  constructor(e) {
    super(), we(this, e, Ii, wi, _e, { use: 0, class: 1, getElement: 7 });
  }
  get getElement() {
    return this.$$.ctx[7];
  }
}
function Li(n) {
  let e, t, r, i, a, s, o;
  const l = n[15].default,
    u = Ee(l, n, n[14], null);
  let d = [
      {
        class: (t = x({
          [n[1]]: !0,
          'mdc-data-table__header-row': n[7],
          'mdc-data-table__row': !n[7],
          'mdc-data-table__row--selected': !n[7] && n[3] && n[3].checked,
          ...n[4],
        })),
      },
      { 'aria-selected': (r = n[3] ? (n[3].checked ? 'true' : 'false') : void 0) },
      n[5],
      n[11],
    ],
    c = {};
  for (let f = 0; f < d.length; f += 1) c = F(c, d[f]);
  return {
    c() {
      (e = J('tr')), u && u.c(), te(e, c);
    },
    m(f, g) {
      I(f, e, g),
        u && u.m(e, null),
        n[16](e),
        (a = !0),
        s ||
          ((o = [
            ee((i = De.call(null, e, n[0]))),
            ee(n[6].call(null, e)),
            ie(e, 'click', n[17]),
            ie(e, 'SMUICheckbox:mount', n[8]),
            ie(e, 'SMUICheckbox:unmount', n[18]),
          ]),
          (s = !0));
    },
    p(f, [g]) {
      u &&
        u.p &&
        (!a || g & 16384) &&
        ve(u, l, f, f[14], a ? be(l, f[14], g, null) : Ae(f[14]), null),
        te(
          e,
          (c = le(d, [
            (!a ||
              (g & 26 &&
                t !==
                  (t = x({
                    [f[1]]: !0,
                    'mdc-data-table__header-row': f[7],
                    'mdc-data-table__row': !f[7],
                    'mdc-data-table__row--selected': !f[7] && f[3] && f[3].checked,
                    ...f[4],
                  })))) && { class: t },
            (!a || (g & 8 && r !== (r = f[3] ? (f[3].checked ? 'true' : 'false') : void 0))) && {
              'aria-selected': r,
            },
            g & 32 && f[5],
            g & 2048 && f[11],
          ]))
        ),
        i && me(i.update) && g & 1 && i.update.call(null, f[0]);
    },
    i(f) {
      a || (w(u, f), (a = !0));
    },
    o(f) {
      L(u, f), (a = !1);
    },
    d(f) {
      f && D(e), u && u.d(f), n[16](null), (s = !1), he(o);
    },
  };
}
let ki = 0;
function Ni(n, e, t) {
  const r = ['use', 'class', 'rowId', 'getElement'];
  let i = re(e, r),
    { $$slots: a = {}, $$scope: s } = e;
  const o = ze(Ce());
  let { use: l = [] } = e,
    { class: u = '' } = e,
    { rowId: d = 'SMUI-data-table-row-' + ki++ } = e,
    c,
    f,
    g = {},
    _ = {},
    E = ye('SMUI:data-table:row:header');
  $e(() => {
    const O = E
      ? {
          _smui_data_table_row_accessor: !1,
          get element() {
            return S();
          },
          get checkbox() {
            return f;
          },
          get rowId() {},
          get selected() {
            var y;
            return (y = f && f.checked) !== null && y !== void 0 ? y : !1;
          },
          addClass: v,
          removeClass: A,
          getAttr: H,
          addAttr: b,
        }
      : {
          _smui_data_table_row_accessor: !0,
          get element() {
            return S();
          },
          get checkbox() {
            return f;
          },
          get rowId() {
            return d;
          },
          get selected() {
            var y;
            return (y = f && f.checked) !== null && y !== void 0 ? y : !1;
          },
          addClass: v,
          removeClass: A,
          getAttr: H,
          addAttr: b,
        };
    return (
      se(S(), 'SMUIDataTableRow:mount', O),
      () => {
        se(S(), 'SMUIDataTableRow:unmount', O);
      }
    );
  });
  function p(O) {
    t(3, (f = O.detail));
  }
  function v(O) {
    g[O] || t(4, (g[O] = !0), g);
  }
  function A(O) {
    (!(O in g) || g[O]) && t(4, (g[O] = !1), g);
  }
  function H(O) {
    var y;
    return O in _ ? ((y = _[O]) !== null && y !== void 0 ? y : null) : S().getAttribute(O);
  }
  function b(O, y) {
    _[O] !== y && t(5, (_[O] = y), _);
  }
  function C(O) {
    se(S(), 'SMUIDataTableHeader:click', O);
  }
  function k(O) {
    se(S(), 'SMUIDataTableRow:click', { rowId: d, target: O.target });
  }
  function S() {
    return c;
  }
  function W(O) {
    fe[O ? 'unshift' : 'push'](() => {
      (c = O), t(2, c);
    });
  }
  const G = (O) => (E ? C(O) : k(O)),
    T = () => t(3, (f = void 0));
  return (
    (n.$$set = (O) => {
      (e = F(F({}, e), Ge(O))),
        t(11, (i = re(e, r))),
        'use' in O && t(0, (l = O.use)),
        'class' in O && t(1, (u = O.class)),
        'rowId' in O && t(12, (d = O.rowId)),
        '$$scope' in O && t(14, (s = O.$$scope));
    }),
    [l, u, c, f, g, _, o, E, p, C, k, i, d, S, s, a, W, G, T]
  );
}
class jn extends Ie {
  constructor(e) {
    super(), we(this, e, Ni, Li, _e, { use: 0, class: 1, rowId: 12, getElement: 13 });
  }
  get getElement() {
    return this.$$.ctx[13];
  }
}
function Mi(n) {
  let e, t, r, i, a, s;
  const o = n[22].default,
    l = Ee(o, n, n[21], null);
  let u = [
      {
        class: (t = x({
          [n[1]]: !0,
          'mdc-data-table__cell': !0,
          'mdc-data-table__cell--numeric': n[2],
          'mdc-data-table__cell--checkbox': n[3],
          ...n[7],
        })),
      },
      n[8],
      n[19],
    ],
    d = {};
  for (let c = 0; c < u.length; c += 1) d = F(d, u[c]);
  return {
    c() {
      (e = J('td')), l && l.c(), te(e, d);
    },
    m(c, f) {
      I(c, e, f),
        l && l.m(e, null),
        n[25](e),
        (i = !0),
        a ||
          ((s = [
            ee((r = De.call(null, e, n[0]))),
            ee(n[11].call(null, e)),
            ie(e, 'change', n[26]),
          ]),
          (a = !0));
    },
    p(c, f) {
      l &&
        l.p &&
        (!i || f & 2097152) &&
        ve(l, o, c, c[21], i ? be(o, c[21], f, null) : Ae(c[21]), null),
        te(
          e,
          (d = le(u, [
            (!i ||
              (f & 142 &&
                t !==
                  (t = x({
                    [c[1]]: !0,
                    'mdc-data-table__cell': !0,
                    'mdc-data-table__cell--numeric': c[2],
                    'mdc-data-table__cell--checkbox': c[3],
                    ...c[7],
                  })))) && { class: t },
            f & 256 && c[8],
            f & 524288 && c[19],
          ]))
        ),
        r && me(r.update) && f & 1 && r.update.call(null, c[0]);
    },
    i(c) {
      i || (w(l, c), (i = !0));
    },
    o(c) {
      L(l, c), (i = !1);
    },
    d(c) {
      c && D(e), l && l.d(c), n[25](null), (a = !1), he(s);
    },
  };
}
function Pi(n) {
  let e, t, r, i, a, s, o, l, u;
  const d = [Ui, Bi],
    c = [];
  function f(E, p) {
    return E[5] ? 0 : 1;
  }
  (t = f(n)), (r = c[t] = d[t](n));
  let g = [
      {
        class: (i = x({
          [n[1]]: !0,
          'mdc-data-table__header-cell': !0,
          'mdc-data-table__header-cell--numeric': n[2],
          'mdc-data-table__header-cell--checkbox': n[3],
          'mdc-data-table__header-cell--with-sort': n[5],
          'mdc-data-table__header-cell--sorted': n[5] && n[9] === n[4],
          ...n[7],
        })),
      },
      { role: 'columnheader' },
      { scope: 'col' },
      { 'data-column-id': n[4] },
      { 'aria-sort': (a = n[5] ? (n[9] === n[4] ? n[10] : 'none') : void 0) },
      n[8],
      n[19],
    ],
    _ = {};
  for (let E = 0; E < g.length; E += 1) _ = F(_, g[E]);
  return {
    c() {
      (e = J('th')), r.c(), te(e, _);
    },
    m(E, p) {
      I(E, e, p),
        c[t].m(e, null),
        n[23](e),
        (o = !0),
        l ||
          ((u = [
            ee((s = De.call(null, e, n[0]))),
            ee(n[11].call(null, e)),
            ie(e, 'change', n[24]),
          ]),
          (l = !0));
    },
    p(E, p) {
      let v = t;
      (t = f(E)),
        t === v
          ? c[t].p(E, p)
          : (et(),
            L(c[v], 1, 1, () => {
              c[v] = null;
            }),
            tt(),
            (r = c[t]),
            r ? r.p(E, p) : ((r = c[t] = d[t](E)), r.c()),
            w(r, 1),
            r.m(e, null)),
        te(
          e,
          (_ = le(g, [
            (!o ||
              (p & 702 &&
                i !==
                  (i = x({
                    [E[1]]: !0,
                    'mdc-data-table__header-cell': !0,
                    'mdc-data-table__header-cell--numeric': E[2],
                    'mdc-data-table__header-cell--checkbox': E[3],
                    'mdc-data-table__header-cell--with-sort': E[5],
                    'mdc-data-table__header-cell--sorted': E[5] && E[9] === E[4],
                    ...E[7],
                  })))) && { class: i },
            { role: 'columnheader' },
            { scope: 'col' },
            (!o || p & 16) && { 'data-column-id': E[4] },
            (!o || (p & 1584 && a !== (a = E[5] ? (E[9] === E[4] ? E[10] : 'none') : void 0))) && {
              'aria-sort': a,
            },
            p & 256 && E[8],
            p & 524288 && E[19],
          ]))
        ),
        s && me(s.update) && p & 1 && s.update.call(null, E[0]);
    },
    i(E) {
      o || (w(r), (o = !0));
    },
    o(E) {
      L(r), (o = !1);
    },
    d(E) {
      E && D(e), c[t].d(), n[23](null), (l = !1), he(u);
    },
  };
}
function Bi(n) {
  let e;
  const t = n[22].default,
    r = Ee(t, n, n[21], null);
  return {
    c() {
      r && r.c();
    },
    m(i, a) {
      r && r.m(i, a), (e = !0);
    },
    p(i, a) {
      r &&
        r.p &&
        (!e || a & 2097152) &&
        ve(r, t, i, i[21], e ? be(t, i[21], a, null) : Ae(i[21]), null);
    },
    i(i) {
      e || (w(r, i), (e = !0));
    },
    o(i) {
      L(r, i), (e = !1);
    },
    d(i) {
      r && r.d(i);
    },
  };
}
function Ui(n) {
  let e,
    t,
    r,
    i = (n[9] === n[4] ? (n[10] === 'ascending' ? n[15] : n[16]) : '') + '',
    a,
    s,
    o;
  const l = n[22].default,
    u = Ee(l, n, n[21], null);
  return {
    c() {
      (e = J('div')),
        u && u.c(),
        (t = Y()),
        (r = J('div')),
        (a = ne(i)),
        Q(r, 'class', 'mdc-data-table__sort-status-label'),
        Q(r, 'aria-hidden', 'true'),
        Q(r, 'id', (s = n[4] + '-status-label')),
        Q(e, 'class', 'mdc-data-table__header-cell-wrapper');
    },
    m(d, c) {
      I(d, e, c), u && u.m(e, null), $(e, t), $(e, r), $(r, a), (o = !0);
    },
    p(d, c) {
      u &&
        u.p &&
        (!o || c & 2097152) &&
        ve(u, l, d, d[21], o ? be(l, d[21], c, null) : Ae(d[21]), null),
        (!o || c & 1552) &&
          i !== (i = (d[9] === d[4] ? (d[10] === 'ascending' ? d[15] : d[16]) : '') + '') &&
          Ot(a, i),
        (!o || (c & 16 && s !== (s = d[4] + '-status-label'))) && Q(r, 'id', s);
    },
    i(d) {
      o || (w(u, d), (o = !0));
    },
    o(d) {
      L(u, d), (o = !1);
    },
    d(d) {
      d && D(e), u && u.d(d);
    },
  };
}
function Wi(n) {
  let e, t, r, i;
  const a = [Pi, Mi],
    s = [];
  function o(l, u) {
    return l[12] ? 0 : 1;
  }
  return (
    (e = o(n)),
    (t = s[e] = a[e](n)),
    {
      c() {
        t.c(), (r = Ve());
      },
      m(l, u) {
        s[e].m(l, u), I(l, r, u), (i = !0);
      },
      p(l, [u]) {
        t.p(l, u);
      },
      i(l) {
        i || (w(t), (i = !0));
      },
      o(l) {
        L(t), (i = !1);
      },
      d(l) {
        l && D(r), s[e].d(l);
      },
    }
  );
}
let Fi = 0;
function Gi(n, e, t) {
  const r = ['use', 'class', 'numeric', 'checkbox', 'columnId', 'sortable', 'getElement'];
  let i = re(e, r),
    a,
    s,
    { $$slots: o = {}, $$scope: l } = e;
  const u = ze(Ce());
  let d = ye('SMUI:data-table:row:header'),
    { use: c = [] } = e,
    { class: f = '' } = e,
    { numeric: g = !1 } = e,
    { checkbox: _ = !1 } = e,
    { columnId: E = d ? 'SMUI-data-table-column-' + Fi++ : 'SMUI-data-table-unused' } = e,
    { sortable: p = ye('SMUI:data-table:sortable') } = e,
    v,
    A = {},
    H = {},
    b = ye('SMUI:data-table:sort');
  Qe(n, b, (M) => t(9, (a = M)));
  let C = ye('SMUI:data-table:sortDirection');
  Qe(n, C, (M) => t(10, (s = M)));
  let k = ye('SMUI:data-table:sortAscendingAriaLabel'),
    S = ye('SMUI:data-table:sortDescendingAriaLabel');
  p &&
    (de('SMUI:label:context', 'data-table:sortable-header-cell'),
    de('SMUI:icon-button:context', 'data-table:sortable-header-cell'),
    de('SMUI:icon-button:aria-describedby', E + '-status-label')),
    $e(() => {
      const M = d
        ? {
            _smui_data_table_header_cell_accessor: !0,
            get element() {
              return Z();
            },
            get columnId() {
              return E;
            },
            addClass: W,
            removeClass: G,
            getAttr: T,
            addAttr: O,
          }
        : {
            _smui_data_table_header_cell_accessor: !1,
            get element() {
              return Z();
            },
            get columnId() {},
            addClass: W,
            removeClass: G,
            getAttr: T,
            addAttr: O,
          };
      return (
        se(Z(), 'SMUIDataTableCell:mount', M),
        () => {
          se(Z(), 'SMUIDataTableCell:unmount', M);
        }
      );
    });
  function W(M) {
    A[M] || t(7, (A[M] = !0), A);
  }
  function G(M) {
    (!(M in A) || A[M]) && t(7, (A[M] = !1), A);
  }
  function T(M) {
    var ge;
    return M in H ? ((ge = H[M]) !== null && ge !== void 0 ? ge : null) : Z().getAttribute(M);
  }
  function O(M, ge) {
    H[M] !== ge && t(8, (H[M] = ge), H);
  }
  function y(M) {
    se(Z(), 'SMUIDataTableHeaderCheckbox:change', M);
  }
  function N(M) {
    se(Z(), 'SMUIDataTableBodyCheckbox:change', M);
  }
  function Z() {
    return v;
  }
  function Le(M) {
    fe[M ? 'unshift' : 'push'](() => {
      (v = M), t(6, v);
    });
  }
  const We = (M) => _ && y(M);
  function Pe(M) {
    fe[M ? 'unshift' : 'push'](() => {
      (v = M), t(6, v);
    });
  }
  const ae = (M) => _ && N(M);
  return (
    (n.$$set = (M) => {
      (e = F(F({}, e), Ge(M))),
        t(19, (i = re(e, r))),
        'use' in M && t(0, (c = M.use)),
        'class' in M && t(1, (f = M.class)),
        'numeric' in M && t(2, (g = M.numeric)),
        'checkbox' in M && t(3, (_ = M.checkbox)),
        'columnId' in M && t(4, (E = M.columnId)),
        'sortable' in M && t(5, (p = M.sortable)),
        '$$scope' in M && t(21, (l = M.$$scope));
    }),
    [c, f, g, _, E, p, v, A, H, a, s, u, d, b, C, k, S, y, N, i, Z, l, o, Le, We, Pe, ae]
  );
}
class Ke extends Ie {
  constructor(e) {
    super(),
      we(this, e, Gi, Wi, _e, {
        use: 0,
        class: 1,
        numeric: 2,
        checkbox: 3,
        columnId: 4,
        sortable: 5,
        getElement: 20,
      });
  }
  get getElement() {
    return this.$$.ctx[20];
  }
}
/**
 * @license
 * Copyright 2020 Google Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */ var at = {
    INDETERMINATE_CLASS: 'mdc-circular-progress--indeterminate',
    CLOSED_CLASS: 'mdc-circular-progress--closed',
  },
  xe = {
    ARIA_HIDDEN: 'aria-hidden',
    ARIA_VALUENOW: 'aria-valuenow',
    DETERMINATE_CIRCLE_SELECTOR: '.mdc-circular-progress__determinate-circle',
    RADIUS: 'r',
    STROKE_DASHOFFSET: 'stroke-dashoffset',
  };
/**
 * @license
 * Copyright 2020 Google Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */ var Vi = (function (n) {
  Rt(e, n);
  function e(t) {
    return n.call(this, Me(Me({}, e.defaultAdapter), t)) || this;
  }
  return (
    Object.defineProperty(e, 'cssClasses', {
      get: function () {
        return at;
      },
      enumerable: !1,
      configurable: !0,
    }),
    Object.defineProperty(e, 'strings', {
      get: function () {
        return xe;
      },
      enumerable: !1,
      configurable: !0,
    }),
    Object.defineProperty(e, 'defaultAdapter', {
      get: function () {
        return {
          addClass: function () {},
          getDeterminateCircleAttribute: function () {
            return null;
          },
          hasClass: function () {
            return !1;
          },
          removeClass: function () {},
          removeAttribute: function () {},
          setAttribute: function () {},
          setDeterminateCircleAttribute: function () {},
        };
      },
      enumerable: !1,
      configurable: !0,
    }),
    (e.prototype.init = function () {
      (this.closed = this.adapter.hasClass(at.CLOSED_CLASS)),
        (this.determinate = !this.adapter.hasClass(at.INDETERMINATE_CLASS)),
        (this.progress = 0),
        this.determinate && this.adapter.setAttribute(xe.ARIA_VALUENOW, this.progress.toString()),
        (this.radius = Number(this.adapter.getDeterminateCircleAttribute(xe.RADIUS)));
    }),
    (e.prototype.setDeterminate = function (t) {
      (this.determinate = t),
        this.determinate
          ? (this.adapter.removeClass(at.INDETERMINATE_CLASS), this.setProgress(this.progress))
          : (this.adapter.addClass(at.INDETERMINATE_CLASS),
            this.adapter.removeAttribute(xe.ARIA_VALUENOW));
    }),
    (e.prototype.isDeterminate = function () {
      return this.determinate;
    }),
    (e.prototype.setProgress = function (t) {
      if (((this.progress = t), this.determinate)) {
        var r = (1 - this.progress) * (2 * Math.PI * this.radius);
        this.adapter.setDeterminateCircleAttribute(xe.STROKE_DASHOFFSET, '' + r),
          this.adapter.setAttribute(xe.ARIA_VALUENOW, this.progress.toString());
      }
    }),
    (e.prototype.getProgress = function () {
      return this.progress;
    }),
    (e.prototype.open = function () {
      (this.closed = !1),
        this.adapter.removeClass(at.CLOSED_CLASS),
        this.adapter.removeAttribute(xe.ARIA_HIDDEN);
    }),
    (e.prototype.close = function () {
      (this.closed = !0),
        this.adapter.addClass(at.CLOSED_CLASS),
        this.adapter.setAttribute(xe.ARIA_HIDDEN, 'true');
    }),
    (e.prototype.isClosed = function () {
      return this.closed;
    }),
    e
  );
})(Dt);
function Mn(n, e, t) {
  const r = n.slice();
  return (r[24] = e[t]), r;
}
function Pn(n) {
  let e, t, r, i, a, s, o, l;
  return {
    c() {
      (e = J('div')),
        (t = J('div')),
        (t.innerHTML =
          '<svg class="mdc-circular-progress__indeterminate-circle-graphic" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="18" stroke-dasharray="113.097" stroke-dashoffset="56.549" stroke-width="4"></circle></svg>'),
        (r = Y()),
        (i = J('div')),
        (i.innerHTML =
          '<svg class="mdc-circular-progress__indeterminate-circle-graphic" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="18" stroke-dasharray="113.097" stroke-dashoffset="56.549" stroke-width="3.2"></circle></svg>'),
        (a = Y()),
        (s = J('div')),
        (s.innerHTML =
          '<svg class="mdc-circular-progress__indeterminate-circle-graphic" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="18" stroke-dasharray="113.097" stroke-dashoffset="56.549" stroke-width="4"></circle></svg>'),
        (o = Y()),
        Q(t, 'class', 'mdc-circular-progress__circle-clipper mdc-circular-progress__circle-left'),
        Q(i, 'class', 'mdc-circular-progress__gap-patch'),
        Q(s, 'class', 'mdc-circular-progress__circle-clipper mdc-circular-progress__circle-right'),
        Q(
          e,
          'class',
          (l = x({
            [n[1]]: !0,
            'mdc-circular-progress__spinner-layer': !0,
            ['mdc-circular-progress__color-' + n[24]]: n[5],
          }))
        );
    },
    m(u, d) {
      I(u, e, d), $(e, t), $(e, r), $(e, i), $(e, a), $(e, s), $(e, o);
    },
    p(u, d) {
      d & 34 &&
        l !==
          (l = x({
            [u[1]]: !0,
            'mdc-circular-progress__spinner-layer': !0,
            ['mdc-circular-progress__color-' + u[24]]: u[5],
          })) &&
        Q(e, 'class', l);
    },
    d(u) {
      u && D(e);
    },
  };
}
function zi(n) {
  let e,
    t,
    r,
    i,
    a,
    s,
    o,
    l,
    u,
    d,
    c,
    f,
    g,
    _,
    E = [
      { class: 'mdc-circular-progress__determinate-circle' },
      { cx: '24' },
      { cy: '24' },
      { r: '18' },
      { 'stroke-dasharray': '113.097' },
      { 'stroke-dashoffset': '113.097' },
      { 'stroke-width': '4' },
      n[9],
    ],
    p = {};
  for (let C = 0; C < E.length; C += 1) p = F(p, E[C]);
  let v = Zt(n[5] ? [1, 2, 3, 4] : [1]),
    A = [];
  for (let C = 0; C < v.length; C += 1) A[C] = Pn(Mn(n, v, C));
  let H = [
      {
        class: (l = x({
          [n[1]]: !0,
          'mdc-circular-progress': !0,
          'mdc-circular-progress--indeterminate': n[2],
          'mdc-circular-progress--closed': n[3],
          ...n[7],
        })),
      },
      { role: 'progressbar' },
      { 'aria-valuemin': (u = 0) },
      { 'aria-valuemax': (d = 1) },
      { 'aria-valuenow': (c = n[2] ? void 0 : n[4]) },
      n[8],
      n[12],
    ],
    b = {};
  for (let C = 0; C < H.length; C += 1) b = F(b, H[C]);
  return {
    c() {
      (e = J('div')),
        (t = J('div')),
        (r = Vt('svg')),
        (i = Vt('circle')),
        (a = Vt('circle')),
        (s = Y()),
        (o = J('div'));
      for (let C = 0; C < A.length; C += 1) A[C].c();
      Q(i, 'class', 'mdc-circular-progress__determinate-track'),
        Q(i, 'cx', '24'),
        Q(i, 'cy', '24'),
        Q(i, 'r', '18'),
        Q(i, 'stroke-width', '4'),
        Kt(a, p),
        Q(r, 'class', 'mdc-circular-progress__determinate-circle-graphic'),
        Q(r, 'viewBox', '0 0 48 48'),
        Q(r, 'xmlns', 'http://www.w3.org/2000/svg'),
        Q(t, 'class', 'mdc-circular-progress__determinate-container'),
        Q(o, 'class', 'mdc-circular-progress__indeterminate-container'),
        te(e, b);
    },
    m(C, k) {
      I(C, e, k), $(e, t), $(t, r), $(r, i), $(r, a), n[15](a), $(e, s), $(e, o);
      for (let S = 0; S < A.length; S += 1) A[S] && A[S].m(o, null);
      n[16](e), g || ((_ = [ee((f = De.call(null, e, n[0]))), ee(n[11].call(null, e))]), (g = !0));
    },
    p(C, [k]) {
      if (
        (Kt(
          a,
          (p = le(E, [
            { class: 'mdc-circular-progress__determinate-circle' },
            { cx: '24' },
            { cy: '24' },
            { r: '18' },
            { 'stroke-dasharray': '113.097' },
            { 'stroke-dashoffset': '113.097' },
            { 'stroke-width': '4' },
            k & 512 && C[9],
          ]))
        ),
        k & 34)
      ) {
        v = Zt(C[5] ? [1, 2, 3, 4] : [1]);
        let S;
        for (S = 0; S < v.length; S += 1) {
          const W = Mn(C, v, S);
          A[S] ? A[S].p(W, k) : ((A[S] = Pn(W)), A[S].c(), A[S].m(o, null));
        }
        for (; S < A.length; S += 1) A[S].d(1);
        A.length = v.length;
      }
      te(
        e,
        (b = le(H, [
          k & 142 &&
            l !==
              (l = x({
                [C[1]]: !0,
                'mdc-circular-progress': !0,
                'mdc-circular-progress--indeterminate': C[2],
                'mdc-circular-progress--closed': C[3],
                ...C[7],
              })) && { class: l },
          { role: 'progressbar' },
          { 'aria-valuemin': u },
          { 'aria-valuemax': d },
          k & 20 && c !== (c = C[2] ? void 0 : C[4]) && { 'aria-valuenow': c },
          k & 256 && C[8],
          k & 4096 && C[12],
        ]))
      ),
        f && me(f.update) && k & 1 && f.update.call(null, C[0]);
    },
    i: Ne,
    o: Ne,
    d(C) {
      C && D(e), n[15](null), Jn(A, C), n[16](null), (g = !1), he(_);
    },
  };
}
function ji(n, e, t) {
  const r = ['use', 'class', 'indeterminate', 'closed', 'progress', 'fourColor', 'getElement'];
  let i = re(e, r);
  const a = ze(Ce());
  let { use: s = [] } = e,
    { class: o = '' } = e,
    { indeterminate: l = !1 } = e,
    { closed: u = !1 } = e,
    { progress: d = 0 } = e,
    { fourColor: c = !1 } = e,
    f,
    g,
    _ = {},
    E = {},
    p = {},
    v;
  $e(
    () => (
      t(
        14,
        (g = new Vi({
          addClass: H,
          getDeterminateCircleAttribute: S,
          hasClass: A,
          removeClass: b,
          removeAttribute: k,
          setAttribute: C,
          setDeterminateCircleAttribute: W,
        }))
      ),
      g.init(),
      () => {
        g.destroy();
      }
    )
  );
  function A(y) {
    return y in _ ? _[y] : G().classList.contains(y);
  }
  function H(y) {
    _[y] || t(7, (_[y] = !0), _);
  }
  function b(y) {
    (!(y in _) || _[y]) && t(7, (_[y] = !1), _);
  }
  function C(y, N) {
    E[y] !== N && t(8, (E[y] = N), E);
  }
  function k(y) {
    (!(y in E) || E[y] != null) && t(8, (E[y] = void 0), E);
  }
  function S(y) {
    var N;
    return y in p ? ((N = p[y]) !== null && N !== void 0 ? N : null) : v.getAttribute(y);
  }
  function W(y, N) {
    p[y] !== N && t(9, (p[y] = N), p);
  }
  function G() {
    return f;
  }
  function T(y) {
    fe[y ? 'unshift' : 'push'](() => {
      (v = y), t(10, v);
    });
  }
  function O(y) {
    fe[y ? 'unshift' : 'push'](() => {
      (f = y), t(6, f);
    });
  }
  return (
    (n.$$set = (y) => {
      (e = F(F({}, e), Ge(y))),
        t(12, (i = re(e, r))),
        'use' in y && t(0, (s = y.use)),
        'class' in y && t(1, (o = y.class)),
        'indeterminate' in y && t(2, (l = y.indeterminate)),
        'closed' in y && t(3, (u = y.closed)),
        'progress' in y && t(4, (d = y.progress)),
        'fourColor' in y && t(5, (c = y.fourColor));
    }),
    (n.$$.update = () => {
      n.$$.dirty & 16388 && g && g.isDeterminate() !== !l && g.setDeterminate(!l),
        n.$$.dirty & 16400 && g && g.getProgress() !== d && g.setProgress(d),
        n.$$.dirty & 16392 && g && (u ? g.close() : g.open());
    }),
    [s, o, l, u, d, c, f, _, E, p, v, a, i, G, g, T, O]
  );
}
class Ki extends Ie {
  constructor(e) {
    super(),
      we(this, e, ji, zi, _e, {
        use: 0,
        class: 1,
        indeterminate: 2,
        closed: 3,
        progress: 4,
        fourColor: 5,
        getElement: 13,
      });
  }
  get getElement() {
    return this.$$.ctx[13];
  }
}
function Bn(n, e, t) {
  const r = n.slice();
  return (r[1] = e[t]), r;
}
function qi(n) {
  let e, t;
  return (
    (e = new Si({
      props: {
        stickyHeader: !0,
        style: 'width: 100%;',
        $$slots: { default: [sa] },
        $$scope: { ctx: n },
      },
    })),
    {
      c() {
        K(e.$$.fragment);
      },
      m(r, i) {
        z(e, r, i), (t = !0);
      },
      p(r, i) {
        const a = {};
        i & 17 && (a.$$scope = { dirty: i, ctx: r }), e.$set(a);
      },
      i(r) {
        t || (w(e.$$.fragment, r), (t = !0));
      },
      o(r) {
        L(e.$$.fragment, r), (t = !1);
      },
      d(r) {
        j(e, r);
      },
    }
  );
}
function Xi(n) {
  let e, t, r;
  return (
    (t = new Ki({ props: { style: 'height: 40px; width: 40px;', indeterminate: !0 } })),
    {
      c() {
        (e = J('div')), K(t.$$.fragment), Q(e, 'class', 'loading svelte-196vpo9');
      },
      m(i, a) {
        I(i, e, a), z(t, e, null), (r = !0);
      },
      p: Ne,
      i(i) {
        r || (w(t.$$.fragment, i), (r = !0));
      },
      o(i) {
        L(t.$$.fragment, i), (r = !1);
      },
      d(i) {
        i && D(e), j(t);
      },
    }
  );
}
function Zi(n) {
  let e;
  return {
    c() {
      e = ne('Graph');
    },
    m(t, r) {
      I(t, e, r);
    },
    d(t) {
      t && D(e);
    },
  };
}
function Qi(n) {
  let e;
  return {
    c() {
      e = ne('Description');
    },
    m(t, r) {
      I(t, e, r);
    },
    d(t) {
      t && D(e);
    },
  };
}
function Ji(n) {
  let e;
  return {
    c() {
      e = ne('Date');
    },
    m(t, r) {
      I(t, e, r);
    },
    d(t) {
      t && D(e);
    },
  };
}
function Yi(n) {
  let e;
  return {
    c() {
      e = ne('Author');
    },
    m(t, r) {
      I(t, e, r);
    },
    d(t) {
      t && D(e);
    },
  };
}
function xi(n) {
  let e;
  return {
    c() {
      e = ne('Hash');
    },
    m(t, r) {
      I(t, e, r);
    },
    d(t) {
      t && D(e);
    },
  };
}
function $i(n) {
  let e, t, r, i, a, s, o, l, u, d;
  return (
    (e = new Ke({ props: { $$slots: { default: [Zi] }, $$scope: { ctx: n } } })),
    (r = new Ke({
      props: { style: 'width: 100%;', $$slots: { default: [Qi] }, $$scope: { ctx: n } },
    })),
    (a = new Ke({ props: { $$slots: { default: [Ji] }, $$scope: { ctx: n } } })),
    (o = new Ke({ props: { $$slots: { default: [Yi] }, $$scope: { ctx: n } } })),
    (u = new Ke({ props: { $$slots: { default: [xi] }, $$scope: { ctx: n } } })),
    {
      c() {
        K(e.$$.fragment),
          (t = Y()),
          K(r.$$.fragment),
          (i = Y()),
          K(a.$$.fragment),
          (s = Y()),
          K(o.$$.fragment),
          (l = Y()),
          K(u.$$.fragment);
      },
      m(c, f) {
        z(e, c, f),
          I(c, t, f),
          z(r, c, f),
          I(c, i, f),
          z(a, c, f),
          I(c, s, f),
          z(o, c, f),
          I(c, l, f),
          z(u, c, f),
          (d = !0);
      },
      p(c, f) {
        const g = {};
        f & 16 && (g.$$scope = { dirty: f, ctx: c }), e.$set(g);
        const _ = {};
        f & 16 && (_.$$scope = { dirty: f, ctx: c }), r.$set(_);
        const E = {};
        f & 16 && (E.$$scope = { dirty: f, ctx: c }), a.$set(E);
        const p = {};
        f & 16 && (p.$$scope = { dirty: f, ctx: c }), o.$set(p);
        const v = {};
        f & 16 && (v.$$scope = { dirty: f, ctx: c }), u.$set(v);
      },
      i(c) {
        d ||
          (w(e.$$.fragment, c),
          w(r.$$.fragment, c),
          w(a.$$.fragment, c),
          w(o.$$.fragment, c),
          w(u.$$.fragment, c),
          (d = !0));
      },
      o(c) {
        L(e.$$.fragment, c),
          L(r.$$.fragment, c),
          L(a.$$.fragment, c),
          L(o.$$.fragment, c),
          L(u.$$.fragment, c),
          (d = !1);
      },
      d(c) {
        c && (D(t), D(i), D(s), D(l)), j(e, c), j(r, c), j(a, c), j(o, c), j(u, c);
      },
    }
  );
}
function ea(n) {
  let e, t;
  return (
    (e = new jn({ props: { $$slots: { default: [$i] }, $$scope: { ctx: n } } })),
    {
      c() {
        K(e.$$.fragment);
      },
      m(r, i) {
        z(e, r, i), (t = !0);
      },
      p(r, i) {
        const a = {};
        i & 16 && (a.$$scope = { dirty: i, ctx: r }), e.$set(a);
      },
      i(r) {
        t || (w(e.$$.fragment, r), (t = !0));
      },
      o(r) {
        L(e.$$.fragment, r), (t = !1);
      },
      d(r) {
        j(e, r);
      },
    }
  );
}
function ta(n) {
  let e = n[1].message + '',
    t;
  return {
    c() {
      t = ne(e);
    },
    m(r, i) {
      I(r, t, i);
    },
    p(r, i) {
      i & 1 && e !== (e = r[1].message + '') && Ot(t, e);
    },
    d(r) {
      r && D(t);
    },
  };
}
function na(n) {
  let e = n[1].date + '',
    t;
  return {
    c() {
      t = ne(e);
    },
    m(r, i) {
      I(r, t, i);
    },
    p(r, i) {
      i & 1 && e !== (e = r[1].date + '') && Ot(t, e);
    },
    d(r) {
      r && D(t);
    },
  };
}
function ra(n) {
  let e = n[1].author_name + '',
    t;
  return {
    c() {
      t = ne(e);
    },
    m(r, i) {
      I(r, t, i);
    },
    p(r, i) {
      i & 1 && e !== (e = r[1].author_name + '') && Ot(t, e);
    },
    d(r) {
      r && D(t);
    },
  };
}
function ia(n) {
  let e = n[1].hash + '',
    t;
  return {
    c() {
      t = ne(e);
    },
    m(r, i) {
      I(r, t, i);
    },
    p(r, i) {
      i & 1 && e !== (e = r[1].hash + '') && Ot(t, e);
    },
    d(r) {
      r && D(t);
    },
  };
}
function aa(n) {
  let e, t, r, i, a, s, o, l, u, d, c;
  return (
    (e = new Ke({})),
    (r = new Ke({ props: { $$slots: { default: [ta] }, $$scope: { ctx: n } } })),
    (a = new Ke({ props: { $$slots: { default: [na] }, $$scope: { ctx: n } } })),
    (o = new Ke({ props: { $$slots: { default: [ra] }, $$scope: { ctx: n } } })),
    (u = new Ke({ props: { $$slots: { default: [ia] }, $$scope: { ctx: n } } })),
    {
      c() {
        K(e.$$.fragment),
          (t = Y()),
          K(r.$$.fragment),
          (i = Y()),
          K(a.$$.fragment),
          (s = Y()),
          K(o.$$.fragment),
          (l = Y()),
          K(u.$$.fragment),
          (d = Y());
      },
      m(f, g) {
        z(e, f, g),
          I(f, t, g),
          z(r, f, g),
          I(f, i, g),
          z(a, f, g),
          I(f, s, g),
          z(o, f, g),
          I(f, l, g),
          z(u, f, g),
          I(f, d, g),
          (c = !0);
      },
      p(f, g) {
        const _ = {};
        g & 17 && (_.$$scope = { dirty: g, ctx: f }), r.$set(_);
        const E = {};
        g & 17 && (E.$$scope = { dirty: g, ctx: f }), a.$set(E);
        const p = {};
        g & 17 && (p.$$scope = { dirty: g, ctx: f }), o.$set(p);
        const v = {};
        g & 17 && (v.$$scope = { dirty: g, ctx: f }), u.$set(v);
      },
      i(f) {
        c ||
          (w(e.$$.fragment, f),
          w(r.$$.fragment, f),
          w(a.$$.fragment, f),
          w(o.$$.fragment, f),
          w(u.$$.fragment, f),
          (c = !0));
      },
      o(f) {
        L(e.$$.fragment, f),
          L(r.$$.fragment, f),
          L(a.$$.fragment, f),
          L(o.$$.fragment, f),
          L(u.$$.fragment, f),
          (c = !1);
      },
      d(f) {
        f && (D(t), D(i), D(s), D(l), D(d)), j(e, f), j(r, f), j(a, f), j(o, f), j(u, f);
      },
    }
  );
}
function Un(n, e) {
  let t, r, i;
  return (
    (r = new jn({ props: { $$slots: { default: [aa] }, $$scope: { ctx: e } } })),
    {
      key: n,
      first: null,
      c() {
        (t = Ve()), K(r.$$.fragment), (this.first = t);
      },
      m(a, s) {
        I(a, t, s), z(r, a, s), (i = !0);
      },
      p(a, s) {
        e = a;
        const o = {};
        s & 17 && (o.$$scope = { dirty: s, ctx: e }), r.$set(o);
      },
      i(a) {
        i || (w(r.$$.fragment, a), (i = !0));
      },
      o(a) {
        L(r.$$.fragment, a), (i = !1);
      },
      d(a) {
        a && D(t), j(r, a);
      },
    }
  );
}
function oa(n) {
  let e = [],
    t = new Map(),
    r,
    i,
    a = Zt(n[0]);
  const s = (o) => o[1].hash;
  for (let o = 0; o < a.length; o += 1) {
    let l = Bn(n, a, o),
      u = s(l);
    t.set(u, (e[o] = Un(u, l)));
  }
  return {
    c() {
      for (let o = 0; o < e.length; o += 1) e[o].c();
      r = Ve();
    },
    m(o, l) {
      for (let u = 0; u < e.length; u += 1) e[u] && e[u].m(o, l);
      I(o, r, l), (i = !0);
    },
    p(o, l) {
      l & 1 &&
        ((a = Zt(o[0])), et(), (e = or(e, l, s, 1, o, a, t, r.parentNode, ar, Un, r, Bn)), tt());
    },
    i(o) {
      if (!i) {
        for (let l = 0; l < a.length; l += 1) w(e[l]);
        i = !0;
      }
    },
    o(o) {
      for (let l = 0; l < e.length; l += 1) L(e[l]);
      i = !1;
    },
    d(o) {
      o && D(r);
      for (let l = 0; l < e.length; l += 1) e[l].d(o);
    },
  };
}
function sa(n) {
  let e, t, r, i;
  return (
    (e = new Di({ props: { $$slots: { default: [ea] }, $$scope: { ctx: n } } })),
    (r = new Hi({ props: { $$slots: { default: [oa] }, $$scope: { ctx: n } } })),
    {
      c() {
        K(e.$$.fragment), (t = Y()), K(r.$$.fragment);
      },
      m(a, s) {
        z(e, a, s), I(a, t, s), z(r, a, s), (i = !0);
      },
      p(a, s) {
        const o = {};
        s & 16 && (o.$$scope = { dirty: s, ctx: a }), e.$set(o);
        const l = {};
        s & 17 && (l.$$scope = { dirty: s, ctx: a }), r.$set(l);
      },
      i(a) {
        i || (w(e.$$.fragment, a), w(r.$$.fragment, a), (i = !0));
      },
      o(a) {
        L(e.$$.fragment, a), L(r.$$.fragment, a), (i = !1);
      },
      d(a) {
        a && D(t), j(e, a), j(r, a);
      },
    }
  );
}
function la(n) {
  let e, t, r, i;
  const a = [Xi, qi],
    s = [];
  function o(l, u) {
    return l[0] == null ? 0 : 1;
  }
  return (
    (e = o(n)),
    (t = s[e] = a[e](n)),
    {
      c() {
        t.c(), (r = Ve());
      },
      m(l, u) {
        s[e].m(l, u), I(l, r, u), (i = !0);
      },
      p(l, [u]) {
        let d = e;
        (e = o(l)),
          e === d
            ? s[e].p(l, u)
            : (et(),
              L(s[d], 1, 1, () => {
                s[d] = null;
              }),
              tt(),
              (t = s[e]),
              t ? t.p(l, u) : ((t = s[e] = a[e](l)), t.c()),
              w(t, 1),
              t.m(r.parentNode, r));
      },
      i(l) {
        i || (w(t), (i = !0));
      },
      o(l) {
        L(t), (i = !1);
      },
      d(l) {
        l && D(r), s[e].d(l);
      },
    }
  );
}
function ua(n, e, t) {
  let { data: r } = e;
  return (
    (n.$$set = (i) => {
      'data' in i && t(0, (r = i.data));
    }),
    [r]
  );
}
class ca extends Ie {
  constructor(e) {
    super(), we(this, e, ua, la, _e, { data: 0 });
  }
}
function da(n) {
  let e, t, r, i, a, s, o;
  return (
    (r = new Ei({ props: { loadData: n[1] } })),
    (s = new ca({ props: { data: n[0] } })),
    {
      c() {
        (e = J('div')),
          (t = J('div')),
          K(r.$$.fragment),
          (i = Y()),
          (a = J('div')),
          K(s.$$.fragment),
          Q(t, 'class', 'header-container svelte-16b0eoq'),
          Q(a, 'class', 'content-container svelte-16b0eoq'),
          Q(e, 'class', 'main-container svelte-16b0eoq');
      },
      m(l, u) {
        I(l, e, u), $(e, t), z(r, t, null), $(e, i), $(e, a), z(s, a, null), (o = !0);
      },
      p(l, [u]) {
        const d = {};
        u & 1 && (d.data = l[0]), s.$set(d);
      },
      i(l) {
        o || (w(r.$$.fragment, l), w(s.$$.fragment, l), (o = !0));
      },
      o(l) {
        L(r.$$.fragment, l), L(s.$$.fragment, l), (o = !1);
      },
      d(l) {
        l && D(e), j(r), j(s);
      },
    }
  );
}
function fa(n, e, t) {
  let r;
  $e(async () => {
    await i();
  });
  async function i() {
    const a = await fetch('http://localhost:8080/api/commits', { method: 'GET' });
    t(0, (r = a.ok ? await a.json() : []));
  }
  return [r, i];
}
class ha extends Ie {
  constructor(e) {
    super(), we(this, e, fa, da, _e, {});
  }
}
new ha({ target: document.getElementById('app') });
