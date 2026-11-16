/* Morrigan app runtime.
   Renders a canvas screen (.dc.html: <x-dc> template + Component script) as a standalone page.
   Supports: {{a.b}} holes in text and attributes, <sc-if value>, <sc-for list as>,
   on* event attributes, <helmet> for head content, class Component extends DCLogic. */
(function () {
  'use strict';
  var W = 390, H = 844;

  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (patch) {
    if (typeof patch === 'function') patch = patch(this.state, this.props);
    this.state = Object.assign({}, this.state, patch || {});
    if (this.__schedule) this.__schedule();
  };
  window.DCLogic = DCLogic;

  var HOLE = /\{\{([\s\S]*?)\}\}/g;
  var ONLY = /^\s*\{\{([\s\S]*?)\}\}\s*$/;

  function lookup(expr, scope) {
    expr = expr.trim();
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(expr)) return parseFloat(expr);
    if (/^(['"]).*\1$/.test(expr)) return expr.slice(1, -1);
    var parts = expr.split('.');
    var v = scope;
    for (var i = 0; i < parts.length; i++) {
      if (v == null) return undefined;
      v = v[parts[i]];
    }
    return v;
  }
  function interp(str, scope) {
    return str.replace(HOLE, function (_, e) { var v = lookup(e, scope); return v == null || v === false ? '' : String(v); });
  }
  function child(scope, name, value) { var s = Object.create(scope); s[name] = value; return s; }

  // compile(node) -> function mount(scope) returning { nodes: [], update(scope) }
  function compile(node) {
    if (node.nodeType === 3) {
      var t = node.nodeValue;
      if (t.indexOf('{{') < 0) return function () { var n = document.createTextNode(t); return { nodes: [n], update: function () {} }; };
      return function (scope) {
        var n = document.createTextNode('');
        var u = function (s) { var v = interp(t, s); if (n.nodeValue !== v) n.nodeValue = v; };
        u(scope);
        return { nodes: [n], update: u };
      };
    }
    if (node.nodeType !== 1) return null;
    var tag = node.localName;

    if (tag === 'sc-if') return compileIf(node);
    if (tag === 'sc-for') return compileFor(node);

    var dyn = [], events = [], drop = [];
    for (var i = 0; i < node.attributes.length; i++) {
      var a = node.attributes[i];
      var name = a.name, val = a.value;
      if (name.indexOf('hint-placeholder') === 0) { drop.push(name); continue; }
      if (/^on[a-z]+$/i.test(name) && val.indexOf('{{') >= 0) {
        var m = ONLY.exec(val);
        events.push({ type: name.slice(2).toLowerCase(), expr: m ? m[1] : val });
        drop.push(name);
        continue;
      }
      if (val.indexOf('{{') >= 0) { dyn.push({ name: name, val: val }); drop.push(name); }
    }
    var kids = [];
    for (var c = node.firstChild; c; c = c.nextSibling) { var k = compile(c); if (k) kids.push(k); }

    return function (scope) {
      var el = node.cloneNode(false);
      for (var d = 0; d < drop.length; d++) el.removeAttribute(drop[d]);
      var cur = scope;
      events.forEach(function (ev) {
        el.addEventListener(ev.type, function (e) {
          var fn = lookup(ev.expr, cur);
          if (typeof fn === 'function') return fn(e);
        }, ev.type === 'wheel' || ev.type.indexOf('touch') === 0 ? { passive: false } : false);
      });
      var subs = kids.map(function (k) { var r = k(scope); r.nodes.forEach(function (n) { el.appendChild(n); }); return r; });
      var setAttrs = function (s) {
        for (var j = 0; j < dyn.length; j++) {
          var at = dyn[j], m = ONLY.exec(at.val), v;
          if (m) {
            v = lookup(m[1], s);
            if (v == null || v === false) { if (el.hasAttribute(at.name)) el.removeAttribute(at.name); continue; }
            v = v === true ? '' : String(v);
          } else v = interp(at.val, s);
          if (el.getAttribute(at.name) !== v) el.setAttribute(at.name, v);
        }
      };
      setAttrs(scope);
      return {
        nodes: [el],
        update: function (s) { cur = s; setAttrs(s); for (var q = 0; q < subs.length; q++) subs[q].update(s); }
      };
    };
  }

  function compileChildren(node) {
    var kids = [];
    for (var c = node.firstChild; c; c = c.nextSibling) { var k = compile(c); if (k) kids.push(k); }
    return function (scope) {
      var subs = kids.map(function (k) { return k(scope); });
      var nodes = [];
      subs.forEach(function (r) { nodes = nodes.concat(r.nodes); });
      return { nodes: nodes, update: function (s) { subs.forEach(function (r) { r.update(s); }); } };
    };
  }

  function compileIf(node) {
    var m = ONLY.exec(node.getAttribute('value') || '');
    var expr = m ? m[1] : 'false';
    var body = compileChildren(node);
    return function (scope) {
      var anchor = document.createComment('if');
      var inst = null;
      var u = function (s) {
        var on = !!lookup(expr, s);
        if (on && !inst) {
          inst = body(s);
          var p = anchor.parentNode;
          if (p) inst.nodes.forEach(function (n) { p.insertBefore(n, anchor); });
        } else if (on && inst) inst.update(s);
        else if (!on && inst) { inst.nodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); }); inst = null; }
      };
      // Initial render: nodes placed before the anchor.
      var first = !!lookup(expr, scope);
      var nodes = [];
      if (first) { inst = body(scope); nodes = inst.nodes.slice(); }
      nodes.push(anchor);
      return { nodes: nodes, update: u };
    };
  }

  function compileFor(node) {
    var m = ONLY.exec(node.getAttribute('list') || '');
    var expr = m ? m[1] : '';
    var as = node.getAttribute('as') || 'item';
    var body = compileChildren(node);
    return function (scope) {
      var anchor = document.createComment('for');
      var items = [];
      var build = function (s, list, place) {
        for (var i = 0; i < list.length; i++) {
          var sc = child(child(s, as, list[i]), as + 'Index', i);
          if (items[i]) items[i].update(sc);
          else { items[i] = body(sc); place(items[i].nodes); }
        }
        while (items.length > list.length) {
          var gone = items.pop();
          gone.nodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
        }
      };
      var initial = [];
      build(scope, lookup(expr, scope) || [], function (ns) { initial = initial.concat(ns); });
      initial.push(anchor);
      return {
        nodes: initial,
        update: function (s) {
          build(s, lookup(expr, s) || [], function (ns) { var p = anchor.parentNode; ns.forEach(function (n) { p.insertBefore(n, anchor); }); });
        }
      };
    };
  }

  // The screen fits inside the safe area (the whole window, unless the browser reports insets).
  // The background still reaches every edge.
  function fit(frame, safe) {
    var r = safe ? safe.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    var s = Math.min(r.width / W, r.height / H);
    frame.style.transform = 'translate(' + (r.left + (r.width - W * s) / 2) + 'px,' + (r.top + (r.height - H * s) / 2) + 'px) scale(' + s + ')';
  }

  function boot() {
    var tpl = document.getElementById('dc-src');
    var host = tpl ? tpl.content : document.querySelector('x-dc');
    var scriptEl = document.querySelector('script[type="text/x-dc"]');
    if (!host || !scriptEl) return;
    if (tpl) tpl.parentNode.removeChild(tpl); else host.parentNode.removeChild(host);

    var helmet = host.querySelector('helmet');
    if (helmet) {
      Array.prototype.slice.call(helmet.childNodes).forEach(function (n) { if (n.nodeType === 1) document.head.appendChild(document.importNode(n, true)); });
      helmet.parentNode.removeChild(helmet);
    }

    var Component;
    try { Component = new Function('DCLogic', scriptEl.textContent + '\nreturn Component;')(DCLogic); }
    catch (err) { console.error('Component script failed', err); return; }
    var props = {};
    try { props = JSON.parse(scriptEl.getAttribute('data-props') || '{}'); } catch (e) {}

    var stage = document.createElement('div'); stage.id = 'dc-stage';
    var frame = document.createElement('div'); frame.id = 'dc-frame';
    var safe = document.createElement('div'); safe.id = 'dc-safe';
    stage.appendChild(safe); stage.appendChild(frame); document.body.appendChild(stage);
    var refit = function () { fit(frame, safe); };
    refit();
    window.addEventListener('resize', refit);

    var mount = compileChildren(host);
    var comp = null;
    var start = function () {
      if (comp && typeof comp.componentWillUnmount === 'function') comp.componentWillUnmount();
      while (frame.firstChild) frame.removeChild(frame.firstChild);
      var c = new Component(props), inst = null, queued = false;
      var render = function () {
        queued = false; if (comp !== c) return;
        try { inst.update(c.renderVals() || {}); } catch (err) { console.error('Screen failed to update', err); }
      };
      c.__schedule = function () { if (!queued && inst) { queued = true; Promise.resolve().then(render); } };
      try { inst = mount(c.renderVals() || {}); }
      catch (err) { console.error('Screen failed to render', err); return; }
      inst.nodes.forEach(function (n) { frame.appendChild(n); });
      comp = c;
      // Extend the screen's own background to the edges of the phone, so no seam shows
      // if the phone's proportions differ from the design.
      var rootEl = frame.firstElementChild;
      if (rootEl) {
        var cs = getComputedStyle(rootEl);
        stage.style.backgroundColor = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : '#0A1119';
        stage.style.backgroundImage = cs.backgroundImage;
      }
      if (typeof c.componentDidMount === 'function') c.componentDidMount();
    };
    start();
    // Android back button: Chrome restores a frozen snapshot of the page, mid-animation.
    // Start the screen fresh instead, as if it had been opened by a link.
    window.addEventListener('pageshow', function (e) { if (e.persisted) start(); });
    document.documentElement.classList.add('dc-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Keep the screen awake while the app is open (Android).
  var lock = null;
  function wake() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
    navigator.wakeLock.request('screen').then(function (l) {
      lock = l;
      // If the system lets go of it while the app is still on screen (battery saver...), ask again once it settles.
      l.addEventListener('release', function () { setTimeout(wake, 1000); });
    }).catch(function () {});
  }
  document.addEventListener('visibilitychange', wake);
  document.addEventListener('pointerdown', function once() { wake(); document.removeEventListener('pointerdown', once); });
  wake();

  // Offline support.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    var sw = navigator.serviceWorker;
    // A new version took over: show it right away, but only on the Menu, so nothing is cut short.
    // The other screens get it on the next change of screen. Not on the very first install.
    var had = !!sw.controller, reloaded = false;
    sw.addEventListener('controllerchange', function () {
      if (!had || reloaded || !/(\/|\/index\.html)$/.test(location.pathname)) return;
      reloaded = true; location.reload();
    });
    window.addEventListener('load', function () {
      sw.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
        // Coming back to the app without changing screen: look for a new version too.
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') reg.update().catch(function () {});
        });
      }).catch(function () {});
    });
  }
})();
