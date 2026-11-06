(function() {
  "use strict";
  /**
  * @vue/shared v3.5.45
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  // @__NO_SIDE_EFFECTS__
  function makeMap(str) {
    const map = /* @__PURE__ */ Object.create(null);
    for (const key of str.split(",")) map[key] = 1;
    return (val) => val in map;
  }
  const EMPTY_OBJ = {};
  const EMPTY_ARR = [];
  const NOOP = () => {
  };
  const NO = () => false;
  const isOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && // uppercase letter
  (key.charCodeAt(2) > 122 || key.charCodeAt(2) < 97);
  const isModelListener = (key) => key.startsWith("onUpdate:");
  const extend = Object.assign;
  const remove = (arr, el) => {
    const i = arr.indexOf(el);
    if (i > -1) {
      arr.splice(i, 1);
    }
  };
  const hasOwnProperty$1 = Object.prototype.hasOwnProperty;
  const hasOwn = (val, key) => hasOwnProperty$1.call(val, key);
  const isArray = Array.isArray;
  const isMap = (val) => toTypeString(val) === "[object Map]";
  const isSet = (val) => toTypeString(val) === "[object Set]";
  const isDate = (val) => toTypeString(val) === "[object Date]";
  const isRegExp = (val) => toTypeString(val) === "[object RegExp]";
  const isFunction = (val) => typeof val === "function";
  const isString = (val) => typeof val === "string";
  const isSymbol = (val) => typeof val === "symbol";
  const isObject = (val) => val !== null && typeof val === "object";
  const isPromise = (val) => {
    return (isObject(val) || isFunction(val)) && isFunction(val.then) && isFunction(val.catch);
  };
  const objectToString = Object.prototype.toString;
  const toTypeString = (value) => objectToString.call(value);
  const toRawType = (value) => {
    return toTypeString(value).slice(8, -1);
  };
  const isPlainObject = (val) => toTypeString(val) === "[object Object]";
  const isIntegerKey = (key) => isString(key) && key !== "NaN" && key[0] !== "-" && "" + parseInt(key, 10) === key;
  const isReservedProp = /* @__PURE__ */ makeMap(
    // the leading comma is intentional so empty string "" is also included
    ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
  );
  const cacheStringFunction = (fn) => {
    const cache = /* @__PURE__ */ Object.create(null);
    return ((str) => {
      const hit = cache[str];
      return hit || (cache[str] = fn(str));
    });
  };
  const camelizeRE = /-\w/g;
  const camelize = /* @__PURE__ */ cacheStringFunction((str) => {
    return str.replace(camelizeRE, (c) => c.slice(1).toUpperCase());
  });
  const hyphenateRE = /\B([A-Z])/g;
  const hyphenate = /* @__PURE__ */ cacheStringFunction(
    (str) => str.replace(hyphenateRE, "-$1").toLowerCase()
  );
  const capitalize = /* @__PURE__ */ cacheStringFunction((str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  });
  const toHandlerKey = /* @__PURE__ */ cacheStringFunction((str) => {
    const s = str ? `on${capitalize(str)}` : ``;
    return s;
  });
  const hasChanged = (value, oldValue) => !Object.is(value, oldValue);
  const invokeArrayFns = (fns, ...arg) => {
    for (let i = 0; i < fns.length; i++) {
      fns[i](...arg);
    }
  };
  const def = (obj, key, value, writable = false) => {
    Object.defineProperty(obj, key, {
      configurable: true,
      enumerable: false,
      writable,
      value
    });
  };
  const looseToNumber = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? val : n;
  };
  const toNumber = (val) => {
    const n = isString(val) ? Number(val) : NaN;
    return isNaN(n) ? val : n;
  };
  let _globalThis;
  const getGlobalThis = () => {
    return _globalThis || (_globalThis = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
  };
  const GLOBALS_ALLOWED = "Infinity,undefined,NaN,isFinite,isNaN,parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt,console,Error,Symbol";
  const isGloballyAllowed = /* @__PURE__ */ makeMap(GLOBALS_ALLOWED);
  function normalizeStyle(value) {
    if (isArray(value)) {
      const res = {};
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        const normalized = isString(item) ? parseStringStyle(item) : normalizeStyle(item);
        if (normalized) {
          for (const key in normalized) {
            res[key] = normalized[key];
          }
        }
      }
      return res;
    } else if (isString(value) || isObject(value)) {
      return value;
    }
  }
  const listDelimiterRE = /;(?![^(]*\))/g;
  const propertyDelimiterRE = /:([^]+)/;
  const styleCommentRE = /"(?:[^"\\]|\\[^])*"|'(?:[^'\\]|\\[^])*'|\\[^]|\/\*[^]*?\*\//g;
  function parseStringStyle(cssText) {
    const ret = {};
    cssText.replace(styleCommentRE, (match) => match.startsWith("/*") ? "" : match).split(listDelimiterRE).forEach((item) => {
      if (item) {
        const tmp = item.split(propertyDelimiterRE);
        tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim());
      }
    });
    return ret;
  }
  function normalizeClass(value) {
    let res = "";
    if (isString(value)) {
      res = value;
    } else if (isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const normalized = normalizeClass(value[i]);
        if (normalized) {
          res += normalized + " ";
        }
      }
    } else if (isObject(value)) {
      for (const name in value) {
        if (value[name]) {
          res += name + " ";
        }
      }
    }
    return res.trim();
  }
  function normalizeProps(props) {
    if (!props) return null;
    let { class: klass, style } = props;
    if (klass && !isString(klass)) {
      props.class = normalizeClass(klass);
    }
    if (style) {
      props.style = normalizeStyle(style);
    }
    return props;
  }
  const specialBooleanAttrs = `itemscope,allowfullscreen,disablepictureinpicture,disableremoteplayback,formnovalidate,ismap,nomodule,novalidate,playsinline,readonly`;
  const isSpecialBooleanAttr = /* @__PURE__ */ makeMap(specialBooleanAttrs);
  function includeBooleanAttr(value) {
    return !!value || value === "";
  }
  function looseCompareArrays(a, b, seen) {
    if (a.length !== b.length) return false;
    let equal = true;
    for (let i = 0; equal && i < a.length; i++) {
      equal = looseEqual(a[i], b[i], seen);
    }
    return equal;
  }
  function looseCompareCollections(a, b, seen) {
    if (a.size !== b.size) return false;
    const candidates = Array.from(b);
    const matched = new Uint8Array(candidates.length);
    for (const item of a) {
      let index = -1;
      for (let i = 0; i < candidates.length; i++) {
        if (!matched[i] && looseEqual(item, candidates[i], seen)) {
          index = i;
          break;
        }
      }
      if (index < 0) return false;
      matched[index] = 1;
    }
    return true;
  }
  function looseCompareObjects(a, b, seen) {
    let aValidType = isMap(a);
    let bValidType = isMap(b);
    if (aValidType || bValidType) {
      return aValidType && bValidType ? looseCompareCollections(a, b, seen) : false;
    }
    aValidType = isSet(a);
    bValidType = isSet(b);
    if (aValidType || bValidType) {
      return aValidType && bValidType ? looseCompareCollections(a, b, seen) : false;
    }
    const aKeysCount = Object.keys(a).length;
    const bKeysCount = Object.keys(b).length;
    if (aKeysCount !== bKeysCount) {
      return false;
    }
    for (const key in a) {
      const aHasKey = a.hasOwnProperty(key);
      const bHasKey = b.hasOwnProperty(key);
      if (aHasKey && !bHasKey || !aHasKey && bHasKey || !looseEqual(a[key], b[key], seen)) {
        return false;
      }
    }
    return String(a) === String(b);
  }
  function looseCompareNested(a, b, seen, compare) {
    if (!seen) {
      seen = [/* @__PURE__ */ new Map(), /* @__PURE__ */ new Map()];
    }
    const [seenA, seenB] = seen;
    if (seenA.has(a) || seenB.has(b)) {
      return seenA.get(a) === b && seenB.get(b) === a;
    }
    seenA.set(a, b);
    seenB.set(b, a);
    const equal = compare(a, b, seen);
    seenA.delete(a);
    seenB.delete(b);
    return equal;
  }
  function looseEqual(a, b, seen) {
    if (a === b) return true;
    let aValidType = isDate(a);
    let bValidType = isDate(b);
    if (aValidType || bValidType) {
      return aValidType && bValidType ? a.getTime() === b.getTime() : false;
    }
    aValidType = isSymbol(a);
    bValidType = isSymbol(b);
    if (aValidType || bValidType) {
      return a === b;
    }
    aValidType = isArray(a);
    bValidType = isArray(b);
    if (aValidType || bValidType) {
      return aValidType && bValidType ? looseCompareNested(a, b, seen, looseCompareArrays) : false;
    }
    aValidType = isObject(a);
    bValidType = isObject(b);
    if (aValidType || bValidType) {
      if (!aValidType || !bValidType) {
        return false;
      }
      return looseCompareNested(a, b, seen, looseCompareObjects);
    }
    return String(a) === String(b);
  }
  function looseIndexOf(arr, val) {
    return arr.findIndex((item) => looseEqual(item, val));
  }
  const isRef$1 = (val) => {
    return !!(val && val["__v_isRef"] === true);
  };
  const toDisplayString = (val) => {
    return isString(val) ? val : val == null ? "" : isArray(val) || isObject(val) && (val.toString === objectToString || !isFunction(val.toString)) ? isRef$1(val) ? toDisplayString(val.value) : JSON.stringify(val, replacer, 2) : String(val);
  };
  const replacer = (_key, val) => {
    if (isRef$1(val)) {
      return replacer(_key, val.value);
    } else if (isMap(val)) {
      return {
        [`Map(${val.size})`]: [...val.entries()].reduce(
          (entries, [key, val2], i) => {
            entries[stringifySymbol(key, i) + " =>"] = val2;
            return entries;
          },
          {}
        )
      };
    } else if (isSet(val)) {
      return {
        [`Set(${val.size})`]: [...val.values()].map((v) => stringifySymbol(v))
      };
    } else if (isSymbol(val)) {
      return stringifySymbol(val);
    } else if (isObject(val) && !isArray(val) && !isPlainObject(val)) {
      return String(val);
    }
    return val;
  };
  const stringifySymbol = (v, i = "") => {
    var _a;
    return (
      // Symbol.description in es2019+ so we need to cast here to pass
      // the lib: es2016 check
      isSymbol(v) ? `Symbol(${(_a = v.description) != null ? _a : i})` : v
    );
  };
  function normalizeCssVarValue(value) {
    if (value == null) {
      return "initial";
    }
    if (typeof value === "string") {
      return value === "" ? " " : value;
    }
    return String(value);
  }
  /**
  * @vue/reactivity v3.5.45
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  let activeEffectScope;
  class EffectScope {
    // TODO isolatedDeclarations "__v_skip"
    constructor(detached = false) {
      this.detached = detached;
      this._active = true;
      this._on = 0;
      this.effects = [];
      this.cleanups = [];
      this._isPaused = false;
      this._warnOnRun = true;
      this.__v_skip = true;
      if (!detached && activeEffectScope) {
        if (activeEffectScope.active) {
          this.parent = activeEffectScope;
          this.index = (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
            this
          ) - 1;
        } else {
          this._active = false;
          this._warnOnRun = false;
        }
      }
    }
    get active() {
      return this._active;
    }
    pause() {
      if (this._active) {
        this._isPaused = true;
        let i, l;
        if (this.scopes) {
          const scopes = this.scopes.slice();
          for (i = 0, l = scopes.length; i < l; i++) {
            scopes[i].pause();
          }
        }
        for (i = 0, l = this.effects.length; i < l; i++) {
          this.effects[i].pause();
        }
      }
    }
    /**
     * Resumes the effect scope, including all child scopes and effects.
     */
    resume() {
      if (this._active) {
        if (this._isPaused) {
          this._isPaused = false;
          let i, l;
          if (this.scopes) {
            const scopes = this.scopes.slice();
            for (i = 0, l = scopes.length; i < l; i++) {
              scopes[i].resume();
            }
          }
          const effects = this.effects.slice();
          for (i = 0, l = effects.length; i < l; i++) {
            effects[i].resume();
          }
        }
      }
    }
    run(fn) {
      if (this._active) {
        const currentEffectScope = activeEffectScope;
        try {
          activeEffectScope = this;
          return fn();
        } finally {
          activeEffectScope = currentEffectScope;
        }
      }
    }
    /**
     * This should only be called on non-detached scopes
     * @internal
     */
    on() {
      if (++this._on === 1) {
        this.prevScope = activeEffectScope;
        activeEffectScope = this;
      }
    }
    /**
     * This should only be called on non-detached scopes
     * @internal
     */
    off() {
      if (this._on > 0 && --this._on === 0) {
        if (activeEffectScope === this) {
          activeEffectScope = this.prevScope;
        } else {
          let current = activeEffectScope;
          while (current) {
            if (current.prevScope === this) {
              current.prevScope = this.prevScope;
              break;
            }
            current = current.prevScope;
          }
        }
        this.prevScope = void 0;
      }
    }
    stop(fromParent) {
      if (this._active) {
        this._active = false;
        let i, l;
        for (i = 0, l = this.effects.length; i < l; i++) {
          this.effects[i].stop();
        }
        this.effects.length = 0;
        for (i = 0, l = this.cleanups.length; i < l; i++) {
          this.cleanups[i]();
        }
        this.cleanups.length = 0;
        if (this.scopes) {
          const scopes = this.scopes.slice();
          for (i = 0, l = scopes.length; i < l; i++) {
            scopes[i].stop(true);
          }
          this.scopes.length = 0;
        }
        if (!this.detached && this.parent && !fromParent) {
          const last = this.parent.scopes.pop();
          if (last && last !== this) {
            this.parent.scopes[this.index] = last;
            last.index = this.index;
          }
        }
        this.parent = void 0;
      }
    }
  }
  function effectScope(detached) {
    return new EffectScope(detached);
  }
  function getCurrentScope() {
    return activeEffectScope;
  }
  function onScopeDispose(fn, failSilently = false) {
    if (activeEffectScope) {
      if (activeEffectScope.active) {
        activeEffectScope.cleanups.push(fn);
      } else {
        fn();
      }
    }
  }
  let activeSub;
  const pausedQueueEffects = /* @__PURE__ */ new WeakSet();
  class ReactiveEffect {
    constructor(fn) {
      this.fn = fn;
      this.deps = void 0;
      this.depsTail = void 0;
      this.flags = 1 | 4;
      this.next = void 0;
      this.cleanup = void 0;
      this.scheduler = void 0;
      if (activeEffectScope) {
        if (activeEffectScope.active) {
          activeEffectScope.effects.push(this);
        } else {
          this.flags &= -2;
        }
      }
    }
    pause() {
      this.flags |= 64;
    }
    resume() {
      if (this.flags & 64) {
        this.flags &= -65;
        if (pausedQueueEffects.has(this)) {
          pausedQueueEffects.delete(this);
          this.trigger();
        }
      }
    }
    /**
     * @internal
     */
    notify() {
      if (this.flags & 2 && !(this.flags & 32)) {
        return;
      }
      if (!(this.flags & 8)) {
        batch(this);
      }
    }
    run() {
      if (!(this.flags & 1)) {
        return this.fn();
      }
      this.flags |= 2;
      cleanupEffect(this);
      prepareDeps(this);
      const prevEffect = activeSub;
      const prevShouldTrack = shouldTrack;
      activeSub = this;
      shouldTrack = true;
      try {
        return this.fn();
      } finally {
        cleanupDeps(this);
        activeSub = prevEffect;
        shouldTrack = prevShouldTrack;
        this.flags &= -3;
      }
    }
    stop() {
      if (this.flags & 1) {
        for (let link = this.deps; link; link = link.nextDep) {
          removeSub(link);
        }
        this.deps = this.depsTail = void 0;
        cleanupEffect(this);
        this.onStop && this.onStop();
        this.flags &= -2;
      }
    }
    trigger() {
      if (this.flags & 64) {
        pausedQueueEffects.add(this);
      } else if (this.scheduler) {
        this.scheduler();
      } else {
        this.runIfDirty();
      }
    }
    /**
     * @internal
     */
    runIfDirty() {
      if (isDirty(this)) {
        this.run();
      }
    }
    get dirty() {
      return isDirty(this);
    }
  }
  let batchDepth = 0;
  let batchedSub;
  let batchedComputed;
  function batch(sub, isComputed = false) {
    sub.flags |= 8;
    if (isComputed) {
      sub.next = batchedComputed;
      batchedComputed = sub;
      return;
    }
    sub.next = batchedSub;
    batchedSub = sub;
  }
  function startBatch() {
    batchDepth++;
  }
  function endBatch() {
    if (--batchDepth > 0) {
      return;
    }
    if (batchedComputed) {
      let e = batchedComputed;
      batchedComputed = void 0;
      while (e) {
        const next = e.next;
        e.next = void 0;
        e.flags &= -9;
        e = next;
      }
    }
    let error;
    while (batchedSub) {
      let e = batchedSub;
      batchedSub = void 0;
      while (e) {
        const next = e.next;
        e.next = void 0;
        e.flags &= -9;
        if (e.flags & 1) {
          try {
            ;
            e.trigger();
          } catch (err) {
            if (!error) error = err;
          }
        }
        e = next;
      }
    }
    if (error) throw error;
  }
  function prepareDeps(sub) {
    for (let link = sub.deps; link; link = link.nextDep) {
      link.version = -1;
      link.prevActiveLink = link.dep.activeLink;
      link.dep.activeLink = link;
    }
  }
  function cleanupDeps(sub) {
    let head;
    let tail = sub.depsTail;
    let link = tail;
    while (link) {
      const prev = link.prevDep;
      if (link.version === -1) {
        if (link === tail) tail = prev;
        removeSub(link);
        removeDep(link);
      } else {
        head = link;
      }
      link.dep.activeLink = link.prevActiveLink;
      link.prevActiveLink = void 0;
      link = prev;
    }
    sub.deps = head;
    sub.depsTail = tail;
  }
  function isDirty(sub) {
    for (let link = sub.deps; link; link = link.nextDep) {
      if (link.dep.version !== link.version || link.dep.computed && (refreshComputed(link.dep.computed) || link.dep.version !== link.version)) {
        return true;
      }
    }
    if (sub._dirty) {
      return true;
    }
    return false;
  }
  function refreshComputed(computed2) {
    if (computed2.flags & 4 && !(computed2.flags & 16)) {
      return;
    }
    computed2.flags &= -17;
    if (computed2.globalVersion === globalVersion) {
      return;
    }
    computed2.globalVersion = globalVersion;
    if (!computed2.isSSR && computed2.flags & 128 && (!computed2.deps && !computed2._dirty || !isDirty(computed2))) {
      return;
    }
    computed2.flags |= 2;
    const dep = computed2.dep;
    const prevSub = activeSub;
    const prevShouldTrack = shouldTrack;
    activeSub = computed2;
    shouldTrack = true;
    try {
      prepareDeps(computed2);
      const value = computed2.fn(computed2._value);
      if (dep.version === 0 || hasChanged(value, computed2._value)) {
        computed2.flags |= 128;
        computed2._value = value;
        dep.version++;
      }
    } catch (err) {
      dep.version++;
      throw err;
    } finally {
      activeSub = prevSub;
      shouldTrack = prevShouldTrack;
      cleanupDeps(computed2);
      computed2.flags &= -3;
    }
  }
  function removeSub(link, soft = false) {
    const { dep, prevSub, nextSub } = link;
    if (prevSub) {
      prevSub.nextSub = nextSub;
      link.prevSub = void 0;
    }
    if (nextSub) {
      nextSub.prevSub = prevSub;
      link.nextSub = void 0;
    }
    if (dep.subs === link) {
      dep.subs = prevSub;
      if (!prevSub && dep.computed) {
        dep.computed.flags &= -5;
        for (let l = dep.computed.deps; l; l = l.nextDep) {
          removeSub(l, true);
        }
      }
    }
    if (!soft && !--dep.sc && dep.map) {
      dep.map.delete(dep.key);
    }
  }
  function removeDep(link) {
    const { prevDep, nextDep } = link;
    if (prevDep) {
      prevDep.nextDep = nextDep;
      link.prevDep = void 0;
    }
    if (nextDep) {
      nextDep.prevDep = prevDep;
      link.nextDep = void 0;
    }
  }
  function effect(fn, options) {
    if (fn.effect instanceof ReactiveEffect) {
      fn = fn.effect.fn;
    }
    const e = new ReactiveEffect(fn);
    if (options) {
      extend(e, options);
    }
    try {
      e.run();
    } catch (err) {
      e.stop();
      throw err;
    }
    const runner = e.run.bind(e);
    runner.effect = e;
    return runner;
  }
  function stop(runner) {
    runner.effect.stop();
  }
  let shouldTrack = true;
  const trackStack = [];
  function pauseTracking() {
    trackStack.push(shouldTrack);
    shouldTrack = false;
  }
  function resetTracking() {
    const last = trackStack.pop();
    shouldTrack = last === void 0 ? true : last;
  }
  function cleanupEffect(e) {
    const { cleanup } = e;
    e.cleanup = void 0;
    if (cleanup) {
      const prevSub = activeSub;
      activeSub = void 0;
      try {
        cleanup();
      } finally {
        activeSub = prevSub;
      }
    }
  }
  let globalVersion = 0;
  class Link {
    constructor(sub, dep) {
      this.sub = sub;
      this.dep = dep;
      this.version = dep.version;
      this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
    }
  }
  class Dep {
    // TODO isolatedDeclarations "__v_skip"
    constructor(computed2) {
      this.computed = computed2;
      this.version = 0;
      this.activeLink = void 0;
      this.subs = void 0;
      this.map = void 0;
      this.key = void 0;
      this.sc = 0;
      this.__v_skip = true;
    }
    track(debugInfo) {
      if (!activeSub || !shouldTrack || activeSub === this.computed) {
        return;
      }
      let link = this.activeLink;
      if (link === void 0 || link.sub !== activeSub) {
        link = this.activeLink = new Link(activeSub, this);
        if (!activeSub.deps) {
          activeSub.deps = activeSub.depsTail = link;
        } else {
          link.prevDep = activeSub.depsTail;
          activeSub.depsTail.nextDep = link;
          activeSub.depsTail = link;
        }
        addSub(link);
      } else if (link.version === -1) {
        link.version = this.version;
        if (link.nextDep) {
          const next = link.nextDep;
          next.prevDep = link.prevDep;
          if (link.prevDep) {
            link.prevDep.nextDep = next;
          }
          link.prevDep = activeSub.depsTail;
          link.nextDep = void 0;
          activeSub.depsTail.nextDep = link;
          activeSub.depsTail = link;
          if (activeSub.deps === link) {
            activeSub.deps = next;
          }
        }
      }
      return link;
    }
    trigger(debugInfo) {
      this.version++;
      globalVersion++;
      this.notify(debugInfo);
    }
    notify(debugInfo) {
      startBatch();
      try {
        if (false) ;
        for (let link = this.subs; link; link = link.prevSub) {
          if (link.sub.notify()) {
            ;
            link.sub.dep.notify();
          }
        }
      } finally {
        endBatch();
      }
    }
  }
  function addSub(link) {
    link.dep.sc++;
    if (link.sub.flags & 4) {
      const computed2 = link.dep.computed;
      if (computed2 && !link.dep.subs) {
        computed2.flags |= 4 | 16;
        for (let l = computed2.deps; l; l = l.nextDep) {
          addSub(l);
        }
      }
      const currentTail = link.dep.subs;
      if (currentTail !== link) {
        link.prevSub = currentTail;
        if (currentTail) currentTail.nextSub = link;
      }
      link.dep.subs = link;
    }
  }
  const targetMap = /* @__PURE__ */ new WeakMap();
  const ITERATE_KEY = /* @__PURE__ */ Symbol(
    ""
  );
  const MAP_KEY_ITERATE_KEY = /* @__PURE__ */ Symbol(
    ""
  );
  const ARRAY_ITERATE_KEY = /* @__PURE__ */ Symbol(
    ""
  );
  function track(target, type, key) {
    if (shouldTrack && activeSub) {
      let depsMap = targetMap.get(target);
      if (!depsMap) {
        targetMap.set(target, depsMap = /* @__PURE__ */ new Map());
      }
      let dep = depsMap.get(key);
      if (!dep) {
        depsMap.set(key, dep = new Dep());
        dep.map = depsMap;
        dep.key = key;
      }
      {
        dep.track();
      }
    }
  }
  function trigger(target, type, key, newValue, oldValue, oldTarget) {
    const depsMap = targetMap.get(target);
    if (!depsMap) {
      globalVersion++;
      return;
    }
    const run = (dep) => {
      if (dep) {
        {
          dep.trigger();
        }
      }
    };
    startBatch();
    if (type === "clear") {
      depsMap.forEach(run);
    } else {
      const targetIsArray = isArray(target);
      const isArrayIndex = targetIsArray && isIntegerKey(key);
      if (targetIsArray && key === "length") {
        const newLength = Number(newValue);
        depsMap.forEach((dep, key2) => {
          if (key2 === "length" || key2 === ARRAY_ITERATE_KEY || !isSymbol(key2) && key2 >= newLength) {
            run(dep);
          }
        });
      } else {
        if (key !== void 0 || depsMap.has(void 0)) {
          run(depsMap.get(key));
        }
        if (isArrayIndex) {
          run(depsMap.get(ARRAY_ITERATE_KEY));
        }
        switch (type) {
          case "add":
            if (!targetIsArray) {
              run(depsMap.get(ITERATE_KEY));
              if (isMap(target)) {
                run(depsMap.get(MAP_KEY_ITERATE_KEY));
              }
            } else if (isArrayIndex) {
              run(depsMap.get("length"));
            }
            break;
          case "delete":
            if (!targetIsArray) {
              run(depsMap.get(ITERATE_KEY));
              if (isMap(target)) {
                run(depsMap.get(MAP_KEY_ITERATE_KEY));
              }
            }
            break;
          case "set":
            if (isMap(target)) {
              run(depsMap.get(ITERATE_KEY));
            }
            break;
        }
      }
    }
    endBatch();
  }
  function getDepFromReactive(object, key) {
    const depMap = targetMap.get(object);
    return depMap && depMap.get(key);
  }
  function reactiveReadArray(array) {
    const raw = /* @__PURE__ */ toRaw(array);
    if (raw === array) return raw;
    track(raw, "iterate", ARRAY_ITERATE_KEY);
    if (/* @__PURE__ */ isShallow(array)) return raw;
    if (!/* @__PURE__ */ isReadonly(array)) return raw.map(toReactive);
    return /* @__PURE__ */ isReactive(array) ? raw.map((item) => toReadonly(toReactive(item))) : raw.map(toReadonly);
  }
  function shallowReadArray(arr) {
    track(arr = /* @__PURE__ */ toRaw(arr), "iterate", ARRAY_ITERATE_KEY);
    return arr;
  }
  function toWrapped(target, item) {
    if (/* @__PURE__ */ isReadonly(target)) {
      return /* @__PURE__ */ isReactive(target) ? toReadonly(toReactive(item)) : toReadonly(item);
    }
    return toReactive(item);
  }
  const arrayInstrumentations = {
    __proto__: null,
    [Symbol.iterator]() {
      return iterator(this, Symbol.iterator, (item) => toWrapped(this, item));
    },
    concat(...args) {
      return reactiveReadArray(this).concat(
        ...args.map((x) => isArray(x) ? reactiveReadArray(x) : x)
      );
    },
    entries() {
      return iterator(this, "entries", (value) => {
        value[1] = toWrapped(this, value[1]);
        return value;
      });
    },
    every(fn, thisArg) {
      return apply(this, "every", fn, thisArg, void 0, arguments);
    },
    filter(fn, thisArg) {
      return apply(
        this,
        "filter",
        fn,
        thisArg,
        (v) => v.map((item) => toWrapped(this, item)),
        arguments
      );
    },
    find(fn, thisArg) {
      return apply(
        this,
        "find",
        fn,
        thisArg,
        (item) => toWrapped(this, item),
        arguments
      );
    },
    findIndex(fn, thisArg) {
      return apply(this, "findIndex", fn, thisArg, void 0, arguments);
    },
    findLast(fn, thisArg) {
      return apply(
        this,
        "findLast",
        fn,
        thisArg,
        (item) => toWrapped(this, item),
        arguments
      );
    },
    findLastIndex(fn, thisArg) {
      return apply(this, "findLastIndex", fn, thisArg, void 0, arguments);
    },
    // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
    forEach(fn, thisArg) {
      return apply(this, "forEach", fn, thisArg, void 0, arguments);
    },
    includes(...args) {
      return searchProxy(this, "includes", args);
    },
    indexOf(...args) {
      return searchProxy(this, "indexOf", args);
    },
    join(separator) {
      return reactiveReadArray(this).join(separator);
    },
    // keys() iterator only reads `length`, no optimization required
    lastIndexOf(...args) {
      return searchProxy(this, "lastIndexOf", args);
    },
    map(fn, thisArg) {
      return apply(this, "map", fn, thisArg, void 0, arguments);
    },
    pop() {
      return noTracking(this, "pop");
    },
    push(...args) {
      return noTracking(this, "push", args);
    },
    reduce(fn, ...args) {
      return reduce(this, "reduce", fn, args);
    },
    reduceRight(fn, ...args) {
      return reduce(this, "reduceRight", fn, args);
    },
    shift() {
      return noTracking(this, "shift");
    },
    // slice could use ARRAY_ITERATE but also seems to beg for range tracking
    some(fn, thisArg) {
      return apply(this, "some", fn, thisArg, void 0, arguments);
    },
    splice(...args) {
      return noTracking(this, "splice", args);
    },
    toReversed() {
      return reactiveReadArray(this).toReversed();
    },
    toSorted(comparer) {
      return reactiveReadArray(this).toSorted(comparer);
    },
    toSpliced(...args) {
      return reactiveReadArray(this).toSpliced(...args);
    },
    unshift(...args) {
      return noTracking(this, "unshift", args);
    },
    values() {
      return iterator(this, "values", (item) => toWrapped(this, item));
    }
  };
  function iterator(self2, method, wrapValue) {
    const arr = shallowReadArray(self2);
    const methodFn = arr[method];
    const iter = methodFn.call(arr);
    if (arr !== self2 && !/* @__PURE__ */ isShallow(self2)) {
      if (iter[Symbol.toStringTag] === "Array Iterator") {
        const wrapped = Object.create(Object.getPrototypeOf(iter));
        wrapped.next = () => wrapResult(iter.next(), wrapValue);
        if (methodFn !== arrayProto[method]) {
          Object.defineProperties(wrapped, {
            return: {
              get() {
                const fn = iter.return;
                return typeof fn === "function" ? fn.bind(iter) : fn;
              }
            },
            throw: {
              get() {
                const fn = iter.throw;
                return typeof fn === "function" ? fn.bind(iter) : fn;
              }
            }
          });
        }
        return wrapped;
      }
      iter._next = iter.next;
      iter.next = () => wrapResult(iter._next(), wrapValue);
    }
    return iter;
  }
  function wrapResult(result, wrapValue) {
    if (!result.done) {
      result.value = wrapValue(result.value);
    }
    return result;
  }
  const arrayProto = Array.prototype;
  function apply(self2, method, fn, thisArg, wrappedRetFn, args) {
    const arr = shallowReadArray(self2);
    const needsWrap = arr !== self2 && !/* @__PURE__ */ isShallow(self2);
    const methodFn = arr[method];
    if (methodFn !== arrayProto[method]) {
      const result2 = methodFn.apply(self2, args);
      return needsWrap ? toReactive(result2) : result2;
    }
    let wrappedFn = fn;
    if (arr !== self2) {
      if (needsWrap) {
        wrappedFn = function(item, index) {
          return fn.call(this, toWrapped(self2, item), index, self2);
        };
      } else if (fn.length > 2) {
        wrappedFn = function(item, index) {
          return fn.call(this, item, index, self2);
        };
      }
    }
    const result = methodFn.call(arr, wrappedFn, thisArg);
    return needsWrap && wrappedRetFn ? wrappedRetFn(result) : result;
  }
  function reduce(self2, method, fn, args) {
    const arr = shallowReadArray(self2);
    const needsWrap = arr !== self2 && !/* @__PURE__ */ isShallow(self2);
    let wrappedFn = fn;
    let wrapInitialAccumulator = false;
    if (arr !== self2) {
      if (needsWrap) {
        wrapInitialAccumulator = args.length === 0;
        wrappedFn = function(acc, item, index) {
          if (wrapInitialAccumulator) {
            wrapInitialAccumulator = false;
            acc = toWrapped(self2, acc);
          }
          return fn.call(this, acc, toWrapped(self2, item), index, self2);
        };
      } else if (fn.length > 3) {
        wrappedFn = function(acc, item, index) {
          return fn.call(this, acc, item, index, self2);
        };
      }
    }
    const result = arr[method](wrappedFn, ...args);
    return wrapInitialAccumulator ? toWrapped(self2, result) : result;
  }
  function searchProxy(self2, method, args) {
    const arr = /* @__PURE__ */ toRaw(self2);
    track(arr, "iterate", ARRAY_ITERATE_KEY);
    const res = arr[method](...args);
    if ((res === -1 || res === false) && /* @__PURE__ */ isProxy(args[0])) {
      args[0] = /* @__PURE__ */ toRaw(args[0]);
      return arr[method](...args);
    }
    return res;
  }
  function noTracking(self2, method, args = []) {
    pauseTracking();
    startBatch();
    const res = (/* @__PURE__ */ toRaw(self2))[method].apply(self2, args);
    endBatch();
    resetTracking();
    return res;
  }
  const isNonTrackableKeys = /* @__PURE__ */ makeMap(`__proto__,__v_isRef,__isVue`);
  const builtInSymbols = /* @__PURE__ */ new Set(
    /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((key) => key !== "arguments" && key !== "caller").map((key) => Symbol[key]).filter(isSymbol)
  );
  function hasOwnProperty(key) {
    if (!isSymbol(key)) key = String(key);
    const obj = /* @__PURE__ */ toRaw(this);
    track(obj, "has", key);
    return obj.hasOwnProperty(key);
  }
  class BaseReactiveHandler {
    constructor(_isReadonly = false, _isShallow = false) {
      this._isReadonly = _isReadonly;
      this._isShallow = _isShallow;
    }
    get(target, key, receiver) {
      if (key === "__v_skip") return target["__v_skip"];
      const isReadonly2 = this._isReadonly, isShallow2 = this._isShallow;
      if (key === "__v_isReactive") {
        return !isReadonly2;
      } else if (key === "__v_isReadonly") {
        return isReadonly2;
      } else if (key === "__v_isShallow") {
        return isShallow2;
      } else if (key === "__v_raw") {
        if (receiver === (isReadonly2 ? isShallow2 ? shallowReadonlyMap : readonlyMap : isShallow2 ? shallowReactiveMap : reactiveMap).get(target) || // receiver is not the reactive proxy, but has the same prototype
        // this means the receiver is a user proxy of the reactive proxy
        Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)) {
          return target;
        }
        return;
      }
      const targetIsArray = isArray(target);
      if (!isReadonly2) {
        let fn;
        if (targetIsArray && (fn = arrayInstrumentations[key])) {
          return fn;
        }
        if (key === "hasOwnProperty") {
          return hasOwnProperty;
        }
      }
      const res = Reflect.get(
        target,
        key,
        // if this is a proxy wrapping a ref, return methods using the raw ref
        // as receiver so that we don't have to call `toRaw` on the ref in all
        // its class methods
        /* @__PURE__ */ isRef(target) ? target : receiver
      );
      if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
        return res;
      }
      if (!isReadonly2) {
        track(target, "get", key);
      }
      if (isShallow2) {
        return res;
      }
      if (/* @__PURE__ */ isRef(res)) {
        const value = targetIsArray && isIntegerKey(key) ? res : res.value;
        return isReadonly2 && isObject(value) ? /* @__PURE__ */ readonly(value) : value;
      }
      if (isObject(res)) {
        return isReadonly2 ? /* @__PURE__ */ readonly(res) : /* @__PURE__ */ reactive$1(res);
      }
      return res;
    }
  }
  class MutableReactiveHandler extends BaseReactiveHandler {
    constructor(isShallow2 = false) {
      super(false, isShallow2);
    }
    set(target, key, value, receiver) {
      let oldValue = target[key];
      const isArrayWithIntegerKey = isArray(target) && isIntegerKey(key);
      if (!this._isShallow) {
        const isOldValueReadonly = /* @__PURE__ */ isReadonly(oldValue);
        if (!/* @__PURE__ */ isShallow(value) && !/* @__PURE__ */ isReadonly(value)) {
          oldValue = /* @__PURE__ */ toRaw(oldValue);
          value = /* @__PURE__ */ toRaw(value);
        }
        if (!isArrayWithIntegerKey && /* @__PURE__ */ isRef(oldValue) && !/* @__PURE__ */ isRef(value)) {
          if (isOldValueReadonly) {
            return true;
          } else {
            oldValue.value = value;
            return true;
          }
        }
      }
      const hadKey = isArrayWithIntegerKey ? Number(key) < target.length : hasOwn(target, key);
      const result = Reflect.set(
        target,
        key,
        value,
        /* @__PURE__ */ isRef(target) ? target : receiver
      );
      if (target === /* @__PURE__ */ toRaw(receiver) && result) {
        if (!hadKey) {
          trigger(target, "add", key, value);
        } else if (hasChanged(value, oldValue)) {
          trigger(target, "set", key, value);
        }
      }
      return result;
    }
    deleteProperty(target, key) {
      const hadKey = hasOwn(target, key);
      target[key];
      const result = Reflect.deleteProperty(target, key);
      if (result && hadKey) {
        trigger(target, "delete", key, void 0);
      }
      return result;
    }
    has(target, key) {
      const result = Reflect.has(target, key);
      if (!isSymbol(key) || !builtInSymbols.has(key)) {
        track(target, "has", key);
      }
      return result;
    }
    ownKeys(target) {
      track(
        target,
        "iterate",
        isArray(target) ? "length" : ITERATE_KEY
      );
      return Reflect.ownKeys(target);
    }
  }
  class ReadonlyReactiveHandler extends BaseReactiveHandler {
    constructor(isShallow2 = false) {
      super(true, isShallow2);
    }
    set(target, key) {
      return true;
    }
    deleteProperty(target, key) {
      return true;
    }
  }
  const mutableHandlers = /* @__PURE__ */ new MutableReactiveHandler();
  const readonlyHandlers = /* @__PURE__ */ new ReadonlyReactiveHandler();
  const shallowReactiveHandlers = /* @__PURE__ */ new MutableReactiveHandler(true);
  const shallowReadonlyHandlers = /* @__PURE__ */ new ReadonlyReactiveHandler(true);
  const toShallow = (value) => value;
  const getProto = (v) => Reflect.getPrototypeOf(v);
  function createIterableMethod(method, isReadonly2, isShallow2) {
    return function(...args) {
      const target = this["__v_raw"];
      const rawTarget = /* @__PURE__ */ toRaw(target);
      const targetIsMap = isMap(rawTarget);
      const isPair = method === "entries" || method === Symbol.iterator && targetIsMap;
      const isKeyOnly = method === "keys" && targetIsMap;
      const innerIterator = target[method](...args);
      const wrap = isShallow2 ? toShallow : isReadonly2 ? toReadonly : toReactive;
      !isReadonly2 && track(
        rawTarget,
        "iterate",
        isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY
      );
      return extend(
        // inheriting all iterator properties
        Object.create(innerIterator),
        {
          // iterator protocol
          next() {
            const { value, done } = innerIterator.next();
            return done ? { value, done } : {
              value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
              done
            };
          }
        }
      );
    };
  }
  function createReadonlyMethod(type) {
    return function(...args) {
      return type === "delete" ? false : type === "clear" ? void 0 : this;
    };
  }
  function createInstrumentations(readonly2, shallow) {
    const instrumentations = {
      get(key) {
        const target = this["__v_raw"];
        const rawTarget = /* @__PURE__ */ toRaw(target);
        const rawKey = /* @__PURE__ */ toRaw(key);
        if (!readonly2) {
          if (hasChanged(key, rawKey)) {
            track(rawTarget, "get", key);
          }
          track(rawTarget, "get", rawKey);
        }
        const { has } = getProto(rawTarget);
        const wrap = shallow ? toShallow : readonly2 ? toReadonly : toReactive;
        if (has.call(rawTarget, key)) {
          return wrap(target.get(key));
        } else if (has.call(rawTarget, rawKey)) {
          return wrap(target.get(rawKey));
        } else if (target !== rawTarget) {
          target.get(key);
        }
      },
      get size() {
        const target = this["__v_raw"];
        !readonly2 && track(/* @__PURE__ */ toRaw(target), "iterate", ITERATE_KEY);
        return target.size;
      },
      has(key) {
        const target = this["__v_raw"];
        const rawTarget = /* @__PURE__ */ toRaw(target);
        const rawKey = /* @__PURE__ */ toRaw(key);
        if (!readonly2) {
          if (hasChanged(key, rawKey)) {
            track(rawTarget, "has", key);
          }
          track(rawTarget, "has", rawKey);
        }
        return key === rawKey ? target.has(key) : target.has(key) || target.has(rawKey);
      },
      forEach(callback, thisArg) {
        const observed = this;
        const target = observed["__v_raw"];
        const rawTarget = /* @__PURE__ */ toRaw(target);
        const wrap = shallow ? toShallow : readonly2 ? toReadonly : toReactive;
        !readonly2 && track(rawTarget, "iterate", ITERATE_KEY);
        return target.forEach((value, key) => {
          return callback.call(thisArg, wrap(value), wrap(key), observed);
        });
      }
    };
    extend(
      instrumentations,
      readonly2 ? {
        add: createReadonlyMethod("add"),
        set: createReadonlyMethod("set"),
        delete: createReadonlyMethod("delete"),
        clear: createReadonlyMethod("clear")
      } : {
        add(value) {
          const target = /* @__PURE__ */ toRaw(this);
          const proto = getProto(target);
          const rawValue = /* @__PURE__ */ toRaw(value);
          const valueToAdd = !shallow && !/* @__PURE__ */ isShallow(value) && !/* @__PURE__ */ isReadonly(value) ? rawValue : value;
          const hadKey = proto.has.call(target, valueToAdd) || hasChanged(value, valueToAdd) && proto.has.call(target, value) || hasChanged(rawValue, valueToAdd) && proto.has.call(target, rawValue);
          if (!hadKey) {
            target.add(valueToAdd);
            trigger(target, "add", valueToAdd, valueToAdd);
          }
          return this;
        },
        set(key, value) {
          if (!shallow && !/* @__PURE__ */ isShallow(value) && !/* @__PURE__ */ isReadonly(value)) {
            value = /* @__PURE__ */ toRaw(value);
          }
          const target = /* @__PURE__ */ toRaw(this);
          const { has, get } = getProto(target);
          let hadKey = has.call(target, key);
          if (!hadKey) {
            key = /* @__PURE__ */ toRaw(key);
            hadKey = has.call(target, key);
          }
          const oldValue = get.call(target, key);
          target.set(key, value);
          if (!hadKey) {
            trigger(target, "add", key, value);
          } else if (hasChanged(value, oldValue)) {
            trigger(target, "set", key, value);
          }
          return this;
        },
        delete(key) {
          const target = /* @__PURE__ */ toRaw(this);
          const { has, get } = getProto(target);
          let hadKey = has.call(target, key);
          if (!hadKey) {
            key = /* @__PURE__ */ toRaw(key);
            hadKey = has.call(target, key);
          }
          get ? get.call(target, key) : void 0;
          const result = target.delete(key);
          if (hadKey) {
            trigger(target, "delete", key, void 0);
          }
          return result;
        },
        clear() {
          const target = /* @__PURE__ */ toRaw(this);
          const hadItems = target.size !== 0;
          const result = target.clear();
          if (hadItems) {
            trigger(
              target,
              "clear",
              void 0,
              void 0
            );
          }
          return result;
        }
      }
    );
    const iteratorMethods = [
      "keys",
      "values",
      "entries",
      Symbol.iterator
    ];
    iteratorMethods.forEach((method) => {
      instrumentations[method] = createIterableMethod(method, readonly2, shallow);
    });
    return instrumentations;
  }
  function createInstrumentationGetter(isReadonly2, shallow) {
    const instrumentations = createInstrumentations(isReadonly2, shallow);
    return (target, key, receiver) => {
      if (key === "__v_isReactive") {
        return !isReadonly2;
      } else if (key === "__v_isReadonly") {
        return isReadonly2;
      } else if (key === "__v_isShallow") {
        return shallow;
      } else if (key === "__v_raw") {
        return target;
      }
      return Reflect.get(
        hasOwn(instrumentations, key) && key in target ? instrumentations : target,
        key,
        receiver
      );
    };
  }
  const mutableCollectionHandlers = {
    get: /* @__PURE__ */ createInstrumentationGetter(false, false)
  };
  const shallowCollectionHandlers = {
    get: /* @__PURE__ */ createInstrumentationGetter(false, true)
  };
  const readonlyCollectionHandlers = {
    get: /* @__PURE__ */ createInstrumentationGetter(true, false)
  };
  const shallowReadonlyCollectionHandlers = {
    get: /* @__PURE__ */ createInstrumentationGetter(true, true)
  };
  const reactiveMap = /* @__PURE__ */ new WeakMap();
  const shallowReactiveMap = /* @__PURE__ */ new WeakMap();
  const readonlyMap = /* @__PURE__ */ new WeakMap();
  const shallowReadonlyMap = /* @__PURE__ */ new WeakMap();
  function targetTypeMap(rawType) {
    switch (rawType) {
      case "Object":
      case "Array":
        return 1;
      case "Map":
      case "Set":
      case "WeakMap":
      case "WeakSet":
        return 2;
      default:
        return 0;
    }
  }
  // @__NO_SIDE_EFFECTS__
  function reactive$1(target) {
    if (/* @__PURE__ */ isReadonly(target)) {
      return target;
    }
    return createReactiveObject(
      target,
      false,
      mutableHandlers,
      mutableCollectionHandlers,
      reactiveMap
    );
  }
  // @__NO_SIDE_EFFECTS__
  function shallowReactive(target) {
    return createReactiveObject(
      target,
      false,
      shallowReactiveHandlers,
      shallowCollectionHandlers,
      shallowReactiveMap
    );
  }
  // @__NO_SIDE_EFFECTS__
  function readonly(target) {
    return createReactiveObject(
      target,
      true,
      readonlyHandlers,
      readonlyCollectionHandlers,
      readonlyMap
    );
  }
  // @__NO_SIDE_EFFECTS__
  function shallowReadonly(target) {
    return createReactiveObject(
      target,
      true,
      shallowReadonlyHandlers,
      shallowReadonlyCollectionHandlers,
      shallowReadonlyMap
    );
  }
  function createReactiveObject(target, isReadonly2, baseHandlers, collectionHandlers, proxyMap) {
    if (!isObject(target)) {
      return target;
    }
    if (target["__v_raw"] && !(isReadonly2 && target["__v_isReactive"])) {
      return target;
    }
    if (target["__v_skip"] || !Object.isExtensible(target)) {
      return target;
    }
    const existingProxy = proxyMap.get(target);
    if (existingProxy) {
      return existingProxy;
    }
    const targetType = targetTypeMap(toRawType(target));
    if (targetType === 0) {
      return target;
    }
    const proxy = new Proxy(
      target,
      targetType === 2 ? collectionHandlers : baseHandlers
    );
    proxyMap.set(target, proxy);
    return proxy;
  }
  // @__NO_SIDE_EFFECTS__
  function isReactive(value) {
    if (/* @__PURE__ */ isReadonly(value)) {
      return /* @__PURE__ */ isReactive(value["__v_raw"]);
    }
    return !!(value && value["__v_isReactive"]);
  }
  // @__NO_SIDE_EFFECTS__
  function isReadonly(value) {
    return !!(value && value["__v_isReadonly"]);
  }
  // @__NO_SIDE_EFFECTS__
  function isShallow(value) {
    return !!(value && value["__v_isShallow"]);
  }
  // @__NO_SIDE_EFFECTS__
  function isProxy(value) {
    return value ? !!value["__v_raw"] : false;
  }
  // @__NO_SIDE_EFFECTS__
  function toRaw(observed) {
    const raw = observed && observed["__v_raw"];
    return raw ? /* @__PURE__ */ toRaw(raw) : observed;
  }
  function markRaw(value) {
    if (!hasOwn(value, "__v_skip") && Object.isExtensible(value)) {
      def(value, "__v_skip", true);
    }
    return value;
  }
  const toReactive = (value) => isObject(value) ? /* @__PURE__ */ reactive$1(value) : value;
  const toReadonly = (value) => isObject(value) ? /* @__PURE__ */ readonly(value) : value;
  // @__NO_SIDE_EFFECTS__
  function isRef(r) {
    return r ? r["__v_isRef"] === true : false;
  }
  // @__NO_SIDE_EFFECTS__
  function ref$j(value) {
    return createRef(value, false);
  }
  // @__NO_SIDE_EFFECTS__
  function shallowRef(value) {
    return createRef(value, true);
  }
  function createRef(rawValue, shallow) {
    if (/* @__PURE__ */ isRef(rawValue)) {
      return rawValue;
    }
    return new RefImpl(rawValue, shallow);
  }
  class RefImpl {
    constructor(value, isShallow2) {
      this.dep = new Dep();
      this["__v_isRef"] = true;
      this["__v_isShallow"] = false;
      this._rawValue = isShallow2 ? value : /* @__PURE__ */ toRaw(value);
      this._value = isShallow2 ? value : toReactive(value);
      this["__v_isShallow"] = isShallow2;
    }
    get value() {
      {
        this.dep.track();
      }
      return this._value;
    }
    set value(newValue) {
      const oldValue = this._rawValue;
      const useDirectValue = this["__v_isShallow"] || /* @__PURE__ */ isShallow(newValue) || /* @__PURE__ */ isReadonly(newValue);
      newValue = useDirectValue ? newValue : /* @__PURE__ */ toRaw(newValue);
      if (hasChanged(newValue, oldValue)) {
        this._rawValue = newValue;
        this._value = useDirectValue ? newValue : toReactive(newValue);
        {
          this.dep.trigger();
        }
      }
    }
  }
  function triggerRef(ref2) {
    if (ref2.dep) {
      {
        ref2.dep.trigger();
      }
    }
  }
  function unref(ref2) {
    return /* @__PURE__ */ isRef(ref2) ? ref2.value : ref2;
  }
  function toValue(source) {
    return isFunction(source) ? source() : unref(source);
  }
  const shallowUnwrapHandlers = {
    get: (target, key, receiver) => key === "__v_raw" ? target : unref(Reflect.get(target, key, receiver)),
    set: (target, key, value, receiver) => {
      const oldValue = target[key];
      if (/* @__PURE__ */ isRef(oldValue) && !/* @__PURE__ */ isRef(value)) {
        oldValue.value = value;
        return true;
      } else {
        return Reflect.set(target, key, value, receiver);
      }
    }
  };
  function proxyRefs(objectWithRefs) {
    return /* @__PURE__ */ isReactive(objectWithRefs) ? objectWithRefs : new Proxy(objectWithRefs, shallowUnwrapHandlers);
  }
  class CustomRefImpl {
    constructor(factory) {
      this["__v_isRef"] = true;
      this._value = void 0;
      const dep = this.dep = new Dep();
      const { get, set } = factory(dep.track.bind(dep), dep.trigger.bind(dep));
      this._get = get;
      this._set = set;
    }
    get value() {
      return this._value = this._get();
    }
    set value(newVal) {
      this._set(newVal);
    }
  }
  function customRef(factory) {
    return new CustomRefImpl(factory);
  }
  // @__NO_SIDE_EFFECTS__
  function toRefs(object) {
    const ret = isArray(object) ? new Array(object.length) : {};
    for (const key in object) {
      ret[key] = propertyToRef(object, key);
    }
    return ret;
  }
  class ObjectRefImpl {
    constructor(_object, key, _defaultValue) {
      this._object = _object;
      this._defaultValue = _defaultValue;
      this["__v_isRef"] = true;
      this._value = void 0;
      this._key = isSymbol(key) ? key : String(key);
      this._raw = /* @__PURE__ */ toRaw(_object);
      let shallow = true;
      let obj = _object;
      if (!isArray(_object) || isSymbol(this._key) || !isIntegerKey(this._key)) {
        do {
          shallow = !/* @__PURE__ */ isProxy(obj) || /* @__PURE__ */ isShallow(obj);
        } while (shallow && (obj = obj["__v_raw"]));
      }
      this._shallow = shallow;
    }
    get value() {
      let val = this._object[this._key];
      if (this._shallow) {
        val = unref(val);
      }
      return this._value = val === void 0 ? this._defaultValue : val;
    }
    set value(newVal) {
      if (this._shallow && /* @__PURE__ */ isRef(this._raw[this._key])) {
        const nestedRef = this._object[this._key];
        if (/* @__PURE__ */ isRef(nestedRef)) {
          nestedRef.value = newVal;
          return;
        }
      }
      this._object[this._key] = newVal;
    }
    get dep() {
      return getDepFromReactive(this._raw, this._key);
    }
  }
  class GetterRefImpl {
    constructor(_getter) {
      this._getter = _getter;
      this["__v_isRef"] = true;
      this["__v_isReadonly"] = true;
      this._value = void 0;
    }
    get value() {
      return this._value = this._getter();
    }
  }
  // @__NO_SIDE_EFFECTS__
  function toRef(source, key, defaultValue) {
    if (/* @__PURE__ */ isRef(source)) {
      return source;
    } else if (isFunction(source)) {
      return new GetterRefImpl(source);
    } else if (isObject(source) && arguments.length > 1) {
      return propertyToRef(source, key, defaultValue);
    } else {
      return /* @__PURE__ */ ref$j(source);
    }
  }
  function propertyToRef(source, key, defaultValue) {
    return new ObjectRefImpl(source, key, defaultValue);
  }
  class ComputedRefImpl {
    constructor(fn, setter, isSSR) {
      this.fn = fn;
      this.setter = setter;
      this._value = void 0;
      this.dep = new Dep(this);
      this.__v_isRef = true;
      this.deps = void 0;
      this.depsTail = void 0;
      this.flags = 16;
      this.globalVersion = globalVersion - 1;
      this.next = void 0;
      this.effect = this;
      this["__v_isReadonly"] = !setter;
      this.isSSR = isSSR;
    }
    /**
     * @internal
     */
    notify() {
      this.flags |= 16;
      if (!(this.flags & 8) && // avoid infinite self recursion
      activeSub !== this) {
        batch(this, true);
        return true;
      }
    }
    get value() {
      const link = this.dep.track();
      refreshComputed(this);
      if (link) {
        link.version = this.dep.version;
      }
      return this._value;
    }
    set value(newValue) {
      if (this.setter) {
        this.setter(newValue);
      }
    }
  }
  // @__NO_SIDE_EFFECTS__
  function computed$i(getterOrOptions, debugOptions, isSSR = false) {
    let getter;
    let setter;
    if (isFunction(getterOrOptions)) {
      getter = getterOrOptions;
    } else {
      getter = getterOrOptions.get;
      setter = getterOrOptions.set;
    }
    const cRef = new ComputedRefImpl(getter, setter, isSSR);
    return cRef;
  }
  const TrackOpTypes = {
    "GET": "get",
    "HAS": "has",
    "ITERATE": "iterate"
  };
  const TriggerOpTypes = {
    "SET": "set",
    "ADD": "add",
    "DELETE": "delete",
    "CLEAR": "clear"
  };
  const INITIAL_WATCHER_VALUE = {};
  const cleanupMap = /* @__PURE__ */ new WeakMap();
  let activeWatcher = void 0;
  function getCurrentWatcher() {
    return activeWatcher;
  }
  function onWatcherCleanup(cleanupFn, failSilently = false, owner = activeWatcher) {
    if (owner) {
      let cleanups = cleanupMap.get(owner);
      if (!cleanups) cleanupMap.set(owner, cleanups = []);
      cleanups.push(cleanupFn);
    }
  }
  function watch$f(source, cb, options = EMPTY_OBJ) {
    const { immediate, deep, once, scheduler, augmentJob, call } = options;
    const reactiveGetter = (source2) => {
      if (deep) return source2;
      if (/* @__PURE__ */ isShallow(source2) || deep === false || deep === 0)
        return traverse(source2, 1);
      return traverse(source2);
    };
    let effect2;
    let getter;
    let cleanup;
    let boundCleanup;
    let forceTrigger = false;
    let isMultiSource = false;
    if (/* @__PURE__ */ isRef(source)) {
      getter = () => source.value;
      forceTrigger = /* @__PURE__ */ isShallow(source);
    } else if (/* @__PURE__ */ isReactive(source)) {
      getter = () => reactiveGetter(source);
      forceTrigger = true;
    } else if (isArray(source)) {
      isMultiSource = true;
      forceTrigger = source.some((s) => /* @__PURE__ */ isReactive(s) || /* @__PURE__ */ isShallow(s));
      getter = () => source.map((s) => {
        if (/* @__PURE__ */ isRef(s)) {
          return s.value;
        } else if (/* @__PURE__ */ isReactive(s)) {
          return reactiveGetter(s);
        } else if (isFunction(s)) {
          return call ? call(s, 2) : s();
        } else ;
      });
    } else if (isFunction(source)) {
      if (cb) {
        getter = call ? () => call(source, 2) : source;
      } else {
        getter = () => {
          if (cleanup) {
            pauseTracking();
            try {
              cleanup();
            } finally {
              resetTracking();
            }
          }
          const currentEffect = activeWatcher;
          activeWatcher = effect2;
          try {
            return call ? call(source, 3, [boundCleanup]) : source(boundCleanup);
          } finally {
            activeWatcher = currentEffect;
          }
        };
      }
    } else {
      getter = NOOP;
    }
    if (cb && deep) {
      const baseGetter = getter;
      const depth = deep === true ? Infinity : deep;
      getter = () => traverse(baseGetter(), depth);
    }
    const scope = getCurrentScope();
    const watchHandle = () => {
      effect2.stop();
      if (scope && scope.active) {
        remove(scope.effects, effect2);
      }
    };
    if (once && cb) {
      const _cb = cb;
      cb = (...args) => {
        try {
          return _cb(...args);
        } finally {
          watchHandle();
        }
      };
    }
    let oldValue = isMultiSource ? new Array(source.length).fill(INITIAL_WATCHER_VALUE) : INITIAL_WATCHER_VALUE;
    const job = (immediateFirstRun) => {
      if (!(effect2.flags & 1) || !effect2.dirty && !immediateFirstRun) {
        return;
      }
      if (cb) {
        const newValue = effect2.run();
        if (immediateFirstRun || deep || forceTrigger || (isMultiSource ? newValue.some((v, i) => hasChanged(v, oldValue[i])) : hasChanged(newValue, oldValue))) {
          const currentWatcher = activeWatcher;
          pauseTracking();
          try {
            if (cleanup) {
              cleanup();
            }
            activeWatcher = effect2;
            const args = [
              newValue,
              // pass undefined as the old value when it's changed for the first time
              oldValue === INITIAL_WATCHER_VALUE ? void 0 : isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE ? [] : oldValue,
              boundCleanup
            ];
            oldValue = newValue;
            call ? call(cb, 3, args) : (
              // @ts-expect-error
              cb(...args)
            );
          } finally {
            activeWatcher = currentWatcher;
            resetTracking();
          }
        }
      } else {
        effect2.run();
      }
    };
    if (augmentJob) {
      augmentJob(job);
    }
    effect2 = new ReactiveEffect(getter);
    effect2.scheduler = scheduler ? () => scheduler(job, false) : job;
    boundCleanup = (fn) => onWatcherCleanup(fn, false, effect2);
    cleanup = effect2.onStop = () => {
      const cleanups = cleanupMap.get(effect2);
      if (cleanups) {
        if (call) {
          call(cleanups, 4);
        } else {
          for (const cleanup2 of cleanups) cleanup2();
        }
        cleanupMap.delete(effect2);
      }
    };
    if (cb) {
      if (immediate) {
        job(true);
      } else {
        oldValue = effect2.run();
      }
    } else if (scheduler) {
      scheduler(job.bind(null, true), true);
    } else {
      effect2.run();
    }
    watchHandle.pause = effect2.pause.bind(effect2);
    watchHandle.resume = effect2.resume.bind(effect2);
    watchHandle.stop = watchHandle;
    return watchHandle;
  }
  function traverse(value, depth = Infinity, seen) {
    if (depth <= 0 || !isObject(value) || value["__v_skip"]) {
      return value;
    }
    seen = seen || /* @__PURE__ */ new Map();
    if ((seen.get(value) || 0) >= depth) {
      return value;
    }
    seen.set(value, depth);
    depth--;
    if (/* @__PURE__ */ isRef(value)) {
      traverse(value.value, depth, seen);
    } else if (isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        traverse(value[i], depth, seen);
      }
    } else if (isSet(value) || isMap(value)) {
      value.forEach((v) => {
        traverse(v, depth, seen);
      });
    } else if (isPlainObject(value)) {
      for (const key in value) {
        traverse(value[key], depth, seen);
      }
      for (const key of Object.getOwnPropertySymbols(value)) {
        if (Object.prototype.propertyIsEnumerable.call(value, key)) {
          traverse(value[key], depth, seen);
        }
      }
    }
    return value;
  }
  /**
  * @vue/runtime-core v3.5.45
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  const stack = [];
  function pushWarningContext(vnode) {
    stack.push(vnode);
  }
  function popWarningContext() {
    stack.pop();
  }
  let isWarning = false;
  function warn$1(msg, ...args) {
    if (isWarning) return;
    isWarning = true;
    pauseTracking();
    const instance = stack.length ? stack[stack.length - 1].component : null;
    const appWarnHandler = instance && instance.appContext.config.warnHandler;
    const trace = getComponentTrace();
    if (appWarnHandler) {
      callWithErrorHandling(
        appWarnHandler,
        instance,
        11,
        [
          // eslint-disable-next-line no-restricted-syntax
          msg + args.map((a) => {
            var _a, _b;
            return (_b = (_a = a.toString) == null ? void 0 : _a.call(a)) != null ? _b : JSON.stringify(a);
          }).join(""),
          instance && instance.proxy,
          trace.map(
            ({ vnode }) => `at <${formatComponentName(instance, vnode.type)}>`
          ).join("\n"),
          trace
        ]
      );
    } else {
      const warnArgs = [`[Vue warn]: ${msg}`, ...args];
      if (trace.length && // avoid spamming console during tests
      true) {
        warnArgs.push(`
`, ...formatTrace(trace));
      }
      console.warn(...warnArgs);
    }
    resetTracking();
    isWarning = false;
  }
  function getComponentTrace() {
    let currentVNode = stack[stack.length - 1];
    if (!currentVNode) {
      return [];
    }
    const normalizedStack = [];
    while (currentVNode) {
      const last = normalizedStack[0];
      if (last && last.vnode === currentVNode) {
        last.recurseCount++;
      } else {
        normalizedStack.push({
          vnode: currentVNode,
          recurseCount: 0
        });
      }
      const parentInstance = currentVNode.component && currentVNode.component.parent;
      currentVNode = parentInstance && parentInstance.vnode;
    }
    return normalizedStack;
  }
  function formatTrace(trace) {
    const logs = [];
    trace.forEach((entry, i) => {
      logs.push(...i === 0 ? [] : [`
`], ...formatTraceEntry(entry));
    });
    return logs;
  }
  function formatTraceEntry({ vnode, recurseCount }) {
    const postfix = recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``;
    const isRoot = vnode.component ? vnode.component.parent == null : false;
    const open = ` at <${formatComponentName(
      vnode.component,
      vnode.type,
      isRoot
    )}`;
    const close = `>` + postfix;
    return vnode.props ? [open, ...formatProps(vnode.props), close] : [open + close];
  }
  function formatProps(props) {
    const res = [];
    const keys = Object.keys(props);
    keys.slice(0, 3).forEach((key) => {
      res.push(...formatProp(key, props[key]));
    });
    if (keys.length > 3) {
      res.push(` ...`);
    }
    return res;
  }
  function formatProp(key, value, raw) {
    if (isString(value)) {
      value = JSON.stringify(value);
      return raw ? value : [`${key}=${value}`];
    } else if (typeof value === "number" || typeof value === "boolean" || value == null) {
      return raw ? value : [`${key}=${value}`];
    } else if (/* @__PURE__ */ isRef(value)) {
      value = formatProp(key, /* @__PURE__ */ toRaw(value.value), true);
      return raw ? value : [`${key}=Ref<`, value, `>`];
    } else if (isFunction(value)) {
      return [`${key}=fn${value.name ? `<${value.name}>` : ``}`];
    } else {
      value = /* @__PURE__ */ toRaw(value);
      return raw ? value : [`${key}=`, value];
    }
  }
  function assertNumber(val, type) {
    return;
  }
  const ErrorCodes = {
    "SETUP_FUNCTION": 0,
    "0": "SETUP_FUNCTION",
    "RENDER_FUNCTION": 1,
    "1": "RENDER_FUNCTION",
    "NATIVE_EVENT_HANDLER": 5,
    "5": "NATIVE_EVENT_HANDLER",
    "COMPONENT_EVENT_HANDLER": 6,
    "6": "COMPONENT_EVENT_HANDLER",
    "VNODE_HOOK": 7,
    "7": "VNODE_HOOK",
    "DIRECTIVE_HOOK": 8,
    "8": "DIRECTIVE_HOOK",
    "TRANSITION_HOOK": 9,
    "9": "TRANSITION_HOOK",
    "APP_ERROR_HANDLER": 10,
    "10": "APP_ERROR_HANDLER",
    "APP_WARN_HANDLER": 11,
    "11": "APP_WARN_HANDLER",
    "FUNCTION_REF": 12,
    "12": "FUNCTION_REF",
    "ASYNC_COMPONENT_LOADER": 13,
    "13": "ASYNC_COMPONENT_LOADER",
    "SCHEDULER": 14,
    "14": "SCHEDULER",
    "COMPONENT_UPDATE": 15,
    "15": "COMPONENT_UPDATE",
    "APP_UNMOUNT_CLEANUP": 16,
    "16": "APP_UNMOUNT_CLEANUP"
  };
  const ErrorTypeStrings$1 = {
    ["sp"]: "serverPrefetch hook",
    ["bc"]: "beforeCreate hook",
    ["c"]: "created hook",
    ["bm"]: "beforeMount hook",
    ["m"]: "mounted hook",
    ["bu"]: "beforeUpdate hook",
    ["u"]: "updated",
    ["bum"]: "beforeUnmount hook",
    ["um"]: "unmounted hook",
    ["a"]: "activated hook",
    ["da"]: "deactivated hook",
    ["ec"]: "errorCaptured hook",
    ["rtc"]: "renderTracked hook",
    ["rtg"]: "renderTriggered hook",
    [0]: "setup function",
    [1]: "render function",
    [2]: "watcher getter",
    [3]: "watcher callback",
    [4]: "watcher cleanup function",
    [5]: "native event handler",
    [6]: "component event handler",
    [7]: "vnode hook",
    [8]: "directive hook",
    [9]: "transition hook",
    [10]: "app errorHandler",
    [11]: "app warnHandler",
    [12]: "ref function",
    [13]: "async component loader",
    [14]: "scheduler flush",
    [15]: "component update",
    [16]: "app unmount cleanup function"
  };
  function callWithErrorHandling(fn, instance, type, args) {
    try {
      return args ? fn(...args) : fn();
    } catch (err) {
      handleError(err, instance, type);
    }
  }
  function callWithAsyncErrorHandling(fn, instance, type, args) {
    if (isFunction(fn)) {
      const res = callWithErrorHandling(fn, instance, type, args);
      if (res && isPromise(res)) {
        res.catch((err) => {
          handleError(err, instance, type, void 0, true);
        });
      }
      return res;
    }
    if (isArray(fn)) {
      const values = [];
      for (let i = 0; i < fn.length; i++) {
        values.push(callWithAsyncErrorHandling(fn[i], instance, type, args));
      }
      return values;
    }
  }
  function handleError(err, instance, type, throwInDev = true, isAsyncError = false) {
    const contextVNode = instance ? instance.vnode : null;
    const { errorHandler, throwUnhandledErrorInProduction } = instance && instance.appContext.config || EMPTY_OBJ;
    if (instance) {
      let cur = instance.parent;
      const exposedInstance = instance.proxy;
      const errorInfo = `https://vuejs.org/error-reference/#runtime-${type}`;
      while (cur) {
        const errorCapturedHooks = cur.ec;
        if (errorCapturedHooks && !cur.isUnmounted && // Async failures may outlive stopped scopes whose unmount effects
        // are deferred or discarded by Suspense.
        (!isAsyncError || cur.scope.active)) {
          for (let i = 0; i < errorCapturedHooks.length; i++) {
            if (errorCapturedHooks[i](err, exposedInstance, errorInfo) === false) {
              return;
            }
          }
        }
        cur = cur.parent;
      }
      if (errorHandler) {
        pauseTracking();
        callWithErrorHandling(errorHandler, null, 10, [
          err,
          exposedInstance,
          errorInfo
        ]);
        resetTracking();
        return;
      }
    }
    logError(err, type, contextVNode, throwInDev, throwUnhandledErrorInProduction);
  }
  function logError(err, type, contextVNode, throwInDev = true, throwInProd = false) {
    if (throwInProd) {
      throw err;
    } else {
      console.error(err);
    }
  }
  const queue = [];
  let flushIndex = -1;
  const pendingPostFlushCbs = [];
  let activePostFlushCbs = null;
  let postFlushIndex = 0;
  const resolvedPromise = /* @__PURE__ */ Promise.resolve();
  let currentFlushPromise = null;
  function nextTick$2(fn) {
    const p2 = currentFlushPromise || resolvedPromise;
    return fn ? p2.then(this ? fn.bind(this) : fn) : p2;
  }
  function findInsertionIndex(id) {
    let start = flushIndex + 1;
    let end = queue.length;
    while (start < end) {
      const middle = start + end >>> 1;
      const middleJob = queue[middle];
      const middleJobId = getId(middleJob);
      if (middleJobId < id || middleJobId === id && middleJob.flags & 2) {
        start = middle + 1;
      } else {
        end = middle;
      }
    }
    return start;
  }
  function queueJob(job) {
    if (!(job.flags & 1)) {
      const jobId = getId(job);
      const lastJob = queue[queue.length - 1];
      if (!lastJob || // fast path when the job id is larger than the tail
      !(job.flags & 2) && jobId >= getId(lastJob)) {
        queue.push(job);
      } else {
        queue.splice(findInsertionIndex(jobId), 0, job);
      }
      job.flags |= 1;
      queueFlush();
    }
  }
  function queueFlush() {
    if (!currentFlushPromise) {
      currentFlushPromise = resolvedPromise.then(flushJobs);
    }
  }
  function queuePostFlushCb(cb) {
    if (!isArray(cb)) {
      if (activePostFlushCbs && cb.id === -1) {
        activePostFlushCbs.splice(postFlushIndex + 1, 0, cb);
      } else if (!(cb.flags & 1)) {
        pendingPostFlushCbs.push(cb);
        cb.flags |= 1;
      }
    } else {
      for (let i = 0; i < cb.length; i++) {
        pendingPostFlushCbs.push(cb[i]);
      }
    }
    queueFlush();
  }
  function flushPreFlushCbs(instance, minUid, seen, i = flushIndex + 1) {
    for (; i < queue.length; i++) {
      const cb = queue[i];
      if (cb && cb.flags & 2) {
        if (instance && cb.id !== instance.uid || minUid !== void 0 && !(cb.id >= minUid)) {
          continue;
        }
        queue.splice(i, 1);
        i = instance ? i - 1 : flushIndex;
        if (cb.flags & 4) {
          cb.flags &= -2;
        }
        cb();
        if (!(cb.flags & 4)) {
          cb.flags &= -2;
        }
      }
    }
  }
  function flushPostFlushCbs(seen, skip, minUid = 0) {
    if (pendingPostFlushCbs.length) {
      let cbs = pendingPostFlushCbs;
      let kept = 0;
      if (skip) {
        cbs = [];
        for (let i = 0; i < pendingPostFlushCbs.length; i++) {
          const cb = pendingPostFlushCbs[i];
          if (cb.i !== void 0 ? !cb.i || cb.i.uid < minUid : skip.has(cb)) {
            pendingPostFlushCbs[kept++] = cb;
          } else {
            cbs.push(cb);
          }
        }
      }
      const deduped = [...new Set(cbs)].sort((a, b) => getId(a) - getId(b));
      pendingPostFlushCbs.length = kept;
      if (activePostFlushCbs) {
        for (let i = 0; i < deduped.length; i++) {
          activePostFlushCbs.push(deduped[i]);
        }
        return;
      }
      activePostFlushCbs = deduped;
      for (postFlushIndex = 0; postFlushIndex < activePostFlushCbs.length; postFlushIndex++) {
        const cb = activePostFlushCbs[postFlushIndex];
        if (cb.flags & 4) {
          cb.flags &= -2;
        }
        if (!(cb.flags & 8)) cb();
        cb.flags &= -2;
      }
      activePostFlushCbs = null;
      postFlushIndex = 0;
    }
  }
  let isFlushing = false;
  function flushOnAppMount(fn, minUid) {
    if (isFlushing) {
      fn();
      return;
    }
    const queued = minUid === void 0 ? void 0 : new Set(pendingPostFlushCbs);
    fn();
    isFlushing = true;
    try {
      flushPreFlushCbs(void 0, minUid);
      flushPostFlushCbs(void 0, queued, minUid);
    } finally {
      isFlushing = false;
    }
  }
  const getId = (job) => job.id == null ? job.flags & 2 ? -1 : Infinity : job.id;
  function flushJobs(seen) {
    try {
      for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
        const job = queue[flushIndex];
        if (job && !(job.flags & 8)) {
          if (false) ;
          if (job.flags & 4) {
            job.flags &= ~1;
          }
          callWithErrorHandling(
            job,
            job.i,
            job.i ? 15 : 14
          );
          if (!(job.flags & 4)) {
            job.flags &= ~1;
          }
        }
      }
    } finally {
      for (; flushIndex < queue.length; flushIndex++) {
        const job = queue[flushIndex];
        if (job) {
          job.flags &= -2;
        }
      }
      flushIndex = -1;
      queue.length = 0;
      flushPostFlushCbs();
      currentFlushPromise = null;
      if (queue.length || pendingPostFlushCbs.length) {
        flushJobs();
      }
    }
  }
  let devtools$1;
  let buffer = [];
  function setDevtoolsHook$1(hook, target) {
    var _a, _b;
    devtools$1 = hook;
    if (devtools$1) {
      devtools$1.enabled = true;
      buffer.forEach(({ event, args }) => devtools$1.emit(event, ...args));
      buffer = [];
    } else if (
      // handle late devtools injection - only do this if we are in an actual
      // browser environment to avoid the timer handle stalling test runner exit
      // (#4815)
      typeof window !== "undefined" && // some envs mock window but not fully
      window.HTMLElement && // also exclude jsdom
      // eslint-disable-next-line no-restricted-syntax
      !((_b = (_a = window.navigator) == null ? void 0 : _a.userAgent) == null ? void 0 : _b.includes("jsdom"))
    ) {
      const replay = target.__VUE_DEVTOOLS_HOOK_REPLAY__ = target.__VUE_DEVTOOLS_HOOK_REPLAY__ || [];
      replay.push((newHook) => {
        setDevtoolsHook$1(newHook, target);
      });
      setTimeout(() => {
        if (!devtools$1) {
          target.__VUE_DEVTOOLS_HOOK_REPLAY__ = null;
          buffer = [];
        }
      }, 3e3);
    } else {
      buffer = [];
    }
  }
  let currentRenderingInstance = null;
  let currentScopeId = null;
  function setCurrentRenderingInstance(instance) {
    const prev = currentRenderingInstance;
    currentRenderingInstance = instance;
    currentScopeId = instance && instance.type.__scopeId || null;
    return prev;
  }
  function pushScopeId(id) {
    currentScopeId = id;
  }
  function popScopeId() {
    currentScopeId = null;
  }
  const withScopeId = (_id) => withCtx;
  function withCtx(fn, ctx = currentRenderingInstance, isNonScopedSlot) {
    if (!ctx) return fn;
    if (fn._n) {
      return fn;
    }
    const renderFnWithContext = (...args) => {
      if (renderFnWithContext._d) {
        setBlockTracking(-1);
      }
      const prevInstance = setCurrentRenderingInstance(ctx);
      const prevStackSize = blockStack.length;
      let res;
      try {
        res = fn(...args);
      } finally {
        for (let i = blockStack.length; i > prevStackSize; i--) closeBlock();
        setCurrentRenderingInstance(prevInstance);
        if (renderFnWithContext._d) {
          setBlockTracking(1);
        }
      }
      return res;
    };
    renderFnWithContext._n = true;
    renderFnWithContext._c = true;
    renderFnWithContext._d = true;
    return renderFnWithContext;
  }
  function withDirectives(vnode, directives) {
    if (currentRenderingInstance === null) {
      return vnode;
    }
    const instance = getComponentPublicInstance(currentRenderingInstance);
    const bindings = vnode.dirs || (vnode.dirs = []);
    for (let i = 0; i < directives.length; i++) {
      let [dir, value, arg, modifiers = EMPTY_OBJ] = directives[i];
      if (dir) {
        if (isFunction(dir)) {
          dir = {
            mounted: dir,
            updated: dir
          };
        }
        if (dir.deep) {
          traverse(value);
        }
        bindings.push({
          dir,
          instance,
          value,
          oldValue: void 0,
          arg,
          modifiers
        });
      }
    }
    return vnode;
  }
  function invokeDirectiveHook(vnode, prevVNode, instance, name) {
    let hookVNode = vnode;
    if (name === "beforeMount") {
      vnode._mount = vnode;
    } else if (name === "beforeUpdate") {
      const mount = prevVNode && prevVNode._mount;
      if (mount) {
        mount._latest = vnode;
        vnode._mount = mount;
      }
    } else if (name === "mounted") {
      const latest = vnode._latest;
      vnode._mount = vnode._latest = void 0;
      if (latest) {
        hookVNode = latest;
        latest._mount = void 0;
      }
    }
    const bindings = hookVNode.dirs;
    const oldBindings = prevVNode && prevVNode.dirs;
    for (let i = 0; i < bindings.length; i++) {
      let binding = bindings[i];
      if (oldBindings) {
        binding.oldValue = oldBindings[i].value;
      } else if (name === "mounted" && binding.oldValue !== void 0) {
        binding = extend({}, binding, { oldValue: void 0 });
      }
      let hook = binding.dir[name];
      if (hook) {
        pauseTracking();
        callWithAsyncErrorHandling(hook, instance, 8, [
          vnode.el,
          binding,
          hookVNode,
          prevVNode
        ]);
        resetTracking();
      }
    }
  }
  function provide(key, value) {
    if (currentInstance) {
      let provides = currentInstance.provides;
      const parentProvides = currentInstance.parent && currentInstance.parent.provides;
      if (parentProvides === provides) {
        provides = currentInstance.provides = Object.create(parentProvides);
      }
      provides[key] = value;
    }
  }
  function inject(key, defaultValue, treatDefaultAsFactory = false) {
    const instance = getCurrentInstance();
    if (instance || currentApp) {
      let provides = currentApp ? currentApp._context.provides : instance ? instance.parent == null || instance.ce ? instance.vnode.appContext && instance.vnode.appContext.provides : instance.parent.provides : void 0;
      if (provides && key in provides) {
        return provides[key];
      } else if (arguments.length > 1) {
        return treatDefaultAsFactory && isFunction(defaultValue) ? defaultValue.call(instance && instance.proxy) : defaultValue;
      } else ;
    }
  }
  function hasInjectionContext() {
    return !!(getCurrentInstance() || currentApp);
  }
  const ssrContextKey = /* @__PURE__ */ Symbol.for("v-scx");
  const useSSRContext = () => {
    {
      const ctx = inject(ssrContextKey);
      return ctx;
    }
  };
  function watchEffect(effect2, options) {
    return doWatch(effect2, null, options);
  }
  function watchPostEffect(effect2, options) {
    return doWatch(
      effect2,
      null,
      { flush: "post" }
    );
  }
  function watchSyncEffect(effect2, options) {
    return doWatch(
      effect2,
      null,
      { flush: "sync" }
    );
  }
  function watch$e(source, cb, options) {
    return doWatch(source, cb, options);
  }
  function doWatch(source, cb, options = EMPTY_OBJ) {
    const { immediate, deep, flush, once } = options;
    const baseWatchOptions = extend({}, options);
    const runsImmediately = cb && immediate || !cb && flush !== "post";
    let ssrCleanup;
    if (isInSSRComponentSetup) {
      if (flush === "sync") {
        const ctx = useSSRContext();
        ssrCleanup = ctx.__watcherHandles || (ctx.__watcherHandles = []);
      } else if (!runsImmediately) {
        const watchStopHandle = () => {
        };
        watchStopHandle.stop = NOOP;
        watchStopHandle.resume = NOOP;
        watchStopHandle.pause = NOOP;
        return watchStopHandle;
      }
    }
    const instance = currentInstance;
    baseWatchOptions.call = (fn, type, args) => callWithAsyncErrorHandling(fn, instance, type, args);
    let isPre = false;
    if (flush === "post") {
      baseWatchOptions.scheduler = (job) => {
        job.i = instance;
        queuePostRenderEffect(job, instance && instance.suspense);
      };
    } else if (flush !== "sync") {
      isPre = true;
      baseWatchOptions.scheduler = (job, isFirstRun) => {
        if (isFirstRun) {
          job();
        } else {
          queueJob(job);
        }
      };
    }
    baseWatchOptions.augmentJob = (job) => {
      if (cb) {
        job.flags |= 4;
      }
      if (isPre) {
        job.flags |= 2;
        if (instance) {
          job.id = instance.uid;
          job.i = instance;
        }
      }
    };
    const watchHandle = watch$f(source, cb, baseWatchOptions);
    if (isInSSRComponentSetup) {
      if (ssrCleanup) {
        ssrCleanup.push(watchHandle);
      } else if (runsImmediately) {
        watchHandle();
      }
    }
    return watchHandle;
  }
  function instanceWatch(source, value, options) {
    const publicThis = this.proxy;
    const getter = isString(source) ? source.includes(".") ? createPathGetter(publicThis, source) : () => publicThis[source] : source.bind(publicThis, publicThis);
    let cb;
    if (isFunction(value)) {
      cb = value;
    } else {
      cb = value.handler;
      options = value;
    }
    const reset = setCurrentInstance(this);
    const res = doWatch(getter, cb.bind(publicThis), options);
    reset();
    return res;
  }
  function createPathGetter(ctx, path) {
    const segments = path.split(".");
    return () => {
      let cur = ctx;
      for (let i = 0; i < segments.length && cur; i++) {
        cur = cur[segments[i]];
      }
      return cur;
    };
  }
  const pendingMounts = /* @__PURE__ */ new WeakMap();
  const TeleportEndKey = /* @__PURE__ */ Symbol("_vte");
  const isTeleport = (type) => type.__isTeleport;
  const isTeleportDisabled = (props) => props && (props.disabled || props.disabled === "");
  const isTeleportDeferred = (props) => props && (props.defer || props.defer === "");
  const isTargetSVG = (target) => typeof SVGElement !== "undefined" && target instanceof SVGElement;
  const isTargetMathML = (target) => typeof MathMLElement === "function" && target instanceof MathMLElement;
  const resolveTarget = (props, select) => {
    const targetSelector = props && props.to;
    if (isString(targetSelector)) {
      if (!select) {
        return null;
      } else {
        const target = select(targetSelector);
        return target;
      }
    } else {
      return targetSelector;
    }
  };
  const TeleportImpl = {
    name: "Teleport",
    __isTeleport: true,
    process(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, internals) {
      const {
        mc: mountChildren,
        pc: patchChildren,
        pbc: patchBlockChildren,
        o: { insert, querySelector, createText, createComment, parentNode }
      } = internals;
      const disabled = isTeleportDisabled(n2.props);
      let { dynamicChildren } = n2;
      const mount = (vnode, container2, anchor2) => {
        if (vnode.shapeFlag & 16) {
          mountChildren(
            vnode.children,
            container2,
            anchor2,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        }
      };
      const mountToTarget = (vnode = n2) => {
        const disabled2 = isTeleportDisabled(vnode.props);
        const target = vnode.target = resolveTarget(vnode.props, querySelector);
        const targetAnchor = prepareAnchor(target, vnode, createText, insert);
        if (target) {
          if (namespace !== "svg" && isTargetSVG(target)) {
            namespace = "svg";
          } else if (namespace !== "mathml" && isTargetMathML(target)) {
            namespace = "mathml";
          }
          if (parentComponent && parentComponent.isCE) {
            (parentComponent.ce._teleportTargets || (parentComponent.ce._teleportTargets = /* @__PURE__ */ new Set())).add(target);
          }
          if (!disabled2) {
            mount(vnode, target, targetAnchor);
            updateCssVars(vnode, false);
          }
        }
      };
      const queuePendingMount = (vnode) => {
        const mountJob = () => {
          if (pendingMounts.get(vnode) !== mountJob) return;
          pendingMounts.delete(vnode);
          if (isTeleportDisabled(vnode.props)) {
            const mountContainer = parentNode(vnode.el) || container;
            mount(vnode, mountContainer, vnode.anchor);
            updateCssVars(vnode, true);
          }
          mountToTarget(vnode);
        };
        pendingMounts.set(vnode, mountJob);
        queuePostRenderEffect(mountJob, parentSuspense);
      };
      if (n1 == null) {
        const placeholder = n2.el = createText("");
        const mainAnchor = n2.anchor = createText("");
        insert(placeholder, container, anchor);
        insert(mainAnchor, container, anchor);
        if (isTeleportDeferred(n2.props) || parentSuspense && parentSuspense.pendingBranch) {
          queuePendingMount(n2);
          return;
        }
        if (disabled) {
          mount(n2, container, mainAnchor);
          updateCssVars(n2, true);
        }
        mountToTarget();
      } else {
        n2.el = n1.el;
        const mainAnchor = n2.anchor = n1.anchor;
        const pendingMount = pendingMounts.get(n1);
        if (pendingMount) {
          pendingMount.flags |= 8;
          pendingMounts.delete(n1);
          queuePendingMount(n2);
          return;
        }
        n2.targetStart = n1.targetStart;
        const target = n2.target = n1.target;
        const targetAnchor = n2.targetAnchor = n1.targetAnchor;
        const wasDisabled = isTeleportDisabled(n1.props);
        const currentContainer = wasDisabled ? container : target;
        const currentAnchor = wasDisabled ? mainAnchor : targetAnchor;
        if (namespace === "svg" || isTargetSVG(target)) {
          namespace = "svg";
        } else if (namespace === "mathml" || isTargetMathML(target)) {
          namespace = "mathml";
        }
        if (dynamicChildren) {
          patchBlockChildren(
            n1.dynamicChildren,
            dynamicChildren,
            currentContainer,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds
          );
          traverseStaticChildren(n1, n2, true);
        } else if (!optimized) {
          patchChildren(
            n1,
            n2,
            currentContainer,
            currentAnchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            false
          );
        }
        if (disabled) {
          if (!wasDisabled) {
            moveTeleport(
              n2,
              container,
              mainAnchor,
              internals,
              1
            );
          } else {
            if (n2.props && n1.props && n2.props.to !== n1.props.to) {
              n2.props.to = n1.props.to;
            }
          }
        } else {
          if ((n2.props && n2.props.to) !== (n1.props && n1.props.to)) {
            const nextTarget = resolveTarget(n2.props, querySelector);
            if (nextTarget) {
              n2.target = nextTarget;
              moveTeleport(
                n2,
                nextTarget,
                null,
                internals,
                0
              );
            }
          } else if (wasDisabled) {
            moveTeleport(
              n2,
              target,
              targetAnchor,
              internals,
              1
            );
          }
        }
        updateCssVars(n2, disabled);
      }
    },
    remove(vnode, parentComponent, parentSuspense, { um: unmount, o: { remove: hostRemove } }, doRemove) {
      const {
        shapeFlag,
        children,
        anchor,
        targetStart,
        targetAnchor,
        target,
        props
      } = vnode;
      const disabled = isTeleportDisabled(props);
      const shouldRemove = doRemove || !disabled;
      const pendingMount = pendingMounts.get(vnode);
      if (pendingMount) {
        pendingMount.flags |= 8;
        pendingMounts.delete(vnode);
      }
      if (target) {
        hostRemove(targetStart);
        hostRemove(targetAnchor);
      }
      doRemove && hostRemove(anchor);
      if (!pendingMount && (disabled || target) && shapeFlag & 16) {
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          unmount(
            child,
            parentComponent,
            parentSuspense,
            shouldRemove,
            !!child.dynamicChildren
          );
        }
      }
    },
    move: moveTeleport,
    hydrate: hydrateTeleport
  };
  function moveTeleport(vnode, container, parentAnchor, { o: { insert }, m: move }, moveType = 2) {
    if (moveType === 0) {
      if (vnode.targetStart) {
        insert(vnode.targetStart, container, parentAnchor);
      }
      insert(vnode.targetAnchor, container, parentAnchor);
      parentAnchor = vnode.targetAnchor;
    }
    const { el, anchor, shapeFlag, children, props } = vnode;
    const isReorder = moveType === 2;
    if (isReorder) {
      insert(el, container, parentAnchor);
    }
    if (!pendingMounts.has(vnode) && (!isReorder || isTeleportDisabled(props))) {
      if (shapeFlag & 16) {
        for (let i = 0; i < children.length; i++) {
          move(
            children[i],
            container,
            parentAnchor,
            2
          );
        }
      }
    }
    if (isReorder) {
      insert(anchor, container, parentAnchor);
    }
  }
  function hydrateTeleport(node, vnode, parentComponent, parentSuspense, slotScopeIds, optimized, {
    o: { nextSibling, parentNode, querySelector, insert, createText }
  }, hydrateChildren) {
    function hydrateAnchor(target2, targetNode) {
      let targetAnchor = targetNode;
      while (targetAnchor) {
        if (targetAnchor && targetAnchor.nodeType === 8) {
          if (targetAnchor.data === "teleport start anchor") {
            vnode.targetStart = targetAnchor;
          } else if (targetAnchor.data === "teleport anchor") {
            vnode.targetAnchor = targetAnchor;
            target2._lpa = vnode.targetAnchor && nextSibling(vnode.targetAnchor);
            break;
          }
        }
        targetAnchor = nextSibling(targetAnchor);
      }
    }
    function hydrateDisabledTeleport(node2, vnode2) {
      vnode2.anchor = hydrateChildren(
        nextSibling(node2),
        vnode2,
        parentNode(node2),
        parentComponent,
        parentSuspense,
        slotScopeIds,
        optimized
      );
    }
    const target = vnode.target = resolveTarget(
      vnode.props,
      querySelector
    );
    const disabled = isTeleportDisabled(vnode.props);
    if (target) {
      const targetNode = target._lpa || target.firstChild;
      if (vnode.shapeFlag & 16) {
        if (disabled) {
          hydrateDisabledTeleport(node, vnode);
          hydrateAnchor(target, targetNode);
          if (!vnode.targetAnchor) {
            prepareAnchor(
              target,
              vnode,
              createText,
              insert,
              // if target is the same as the main view, insert anchors before current node
              // to avoid hydrating mismatch
              parentNode(node) === target ? node : null
            );
          }
        } else {
          vnode.anchor = nextSibling(node);
          hydrateAnchor(target, targetNode);
          if (!vnode.targetAnchor) {
            prepareAnchor(target, vnode, createText, insert);
          }
          hydrateChildren(
            targetNode && nextSibling(targetNode),
            vnode,
            target,
            parentComponent,
            parentSuspense,
            slotScopeIds,
            optimized
          );
        }
      }
      updateCssVars(vnode, disabled);
    } else if (disabled) {
      if (vnode.shapeFlag & 16) {
        hydrateDisabledTeleport(node, vnode);
        vnode.targetStart = node;
        vnode.targetAnchor = nextSibling(node);
      }
    }
    return vnode.anchor && nextSibling(vnode.anchor);
  }
  const Teleport = TeleportImpl;
  function updateCssVars(vnode, isDisabled) {
    const ctx = vnode.ctx;
    if (ctx && ctx.ut) {
      let node, anchor;
      if (isDisabled) {
        node = vnode.el;
        anchor = vnode.anchor;
      } else {
        node = vnode.targetStart;
        anchor = vnode.targetAnchor;
      }
      while (node && node !== anchor) {
        if (node.nodeType === 1) node.setAttribute("data-v-owner", ctx.uid);
        node = node.nextSibling;
      }
      ctx.ut();
    }
  }
  function prepareAnchor(target, vnode, createText, insert, anchor = null) {
    const targetStart = vnode.targetStart = createText("");
    const targetAnchor = vnode.targetAnchor = createText("");
    targetStart[TeleportEndKey] = targetAnchor;
    if (target) {
      insert(targetStart, target, anchor);
      insert(targetAnchor, target, anchor);
    }
    return targetAnchor;
  }
  const leaveCbKey = /* @__PURE__ */ Symbol("_leaveCb");
  const enterCbKey$1 = /* @__PURE__ */ Symbol("_enterCb");
  function useTransitionState() {
    const state = {
      isMounted: false,
      isLeaving: false,
      isUnmounting: false,
      leavingVNodes: /* @__PURE__ */ new Map()
    };
    onMounted$d(() => {
      state.isMounted = true;
    });
    onBeforeUnmount$2(() => {
      state.isUnmounting = true;
    });
    return state;
  }
  const TransitionHookValidator = [Function, Array];
  const BaseTransitionPropsValidators = {
    mode: String,
    appear: Boolean,
    persisted: Boolean,
    // enter
    onBeforeEnter: TransitionHookValidator,
    onEnter: TransitionHookValidator,
    onAfterEnter: TransitionHookValidator,
    onEnterCancelled: TransitionHookValidator,
    // leave
    onBeforeLeave: TransitionHookValidator,
    onLeave: TransitionHookValidator,
    onAfterLeave: TransitionHookValidator,
    onLeaveCancelled: TransitionHookValidator,
    // appear
    onBeforeAppear: TransitionHookValidator,
    onAppear: TransitionHookValidator,
    onAfterAppear: TransitionHookValidator,
    onAppearCancelled: TransitionHookValidator
  };
  const BaseTransitionImpl = {
    name: `BaseTransition`,
    props: BaseTransitionPropsValidators,
    setup(props, { slots }) {
      const instance = getCurrentInstance();
      const state = useTransitionState();
      return () => {
        const children = slots.default && getTransitionRawChildren(slots.default(), true);
        const child = children && children.length ? findNonCommentChild(children) : (
          // Keep explicit default-slot conditionals on the same transition path
          // as regular v-if branches, which render a comment placeholder.
          instance.subTree ? createCommentVNode() : void 0
        );
        if (!child) {
          return;
        }
        const rawProps = /* @__PURE__ */ toRaw(props);
        const { mode } = rawProps;
        if (state.isLeaving) {
          return emptyPlaceholder(child);
        }
        const innerChild = getInnerChild$1(child);
        if (!innerChild) {
          return emptyPlaceholder(child);
        }
        const enterHooks = resolveTransitionHooks(
          innerChild,
          rawProps,
          state,
          instance
        );
        if (innerChild.type !== Comment) {
          setTransitionHooks(innerChild, enterHooks);
        }
        let oldInnerChild = instance.subTree && getInnerChild$1(instance.subTree);
        if (oldInnerChild && oldInnerChild.type !== Comment && !isSameVNodeType(oldInnerChild, innerChild) && getTransitionRoot(instance.subTree)) {
          let leavingHooks = resolveTransitionHooks(
            oldInnerChild,
            rawProps,
            state,
            instance
          );
          setTransitionHooks(oldInnerChild, leavingHooks);
          if (mode === "out-in" && innerChild.type !== Comment) {
            state.isLeaving = true;
            leavingHooks.afterLeave = () => {
              state.isLeaving = false;
              if (!(instance.job.flags & 8)) {
                if (instance.effect.flags & 2) {
                  const job = () => {
                    if (!(instance.job.flags & 8)) {
                      instance.update();
                    }
                  };
                  job.i = instance;
                  queueJob(job);
                } else {
                  instance.update();
                }
              }
              delete leavingHooks.afterLeave;
              oldInnerChild = void 0;
            };
            return emptyPlaceholder(child);
          } else if (mode === "in-out" && innerChild.type !== Comment) {
            leavingHooks.delayLeave = (el, earlyRemove, delayedLeave) => {
              const leavingVNodesCache = getLeavingNodesForType(
                state,
                oldInnerChild
              );
              leavingVNodesCache[String(oldInnerChild.key)] = oldInnerChild;
              el[leaveCbKey] = () => {
                earlyRemove();
                el[leaveCbKey] = void 0;
                delete enterHooks.delayedLeave;
                oldInnerChild = void 0;
              };
              enterHooks.delayedLeave = () => {
                delayedLeave();
                delete enterHooks.delayedLeave;
                oldInnerChild = void 0;
              };
            };
          } else {
            oldInnerChild = void 0;
          }
        } else if (oldInnerChild) {
          oldInnerChild = void 0;
        }
        return child;
      };
    }
  };
  function findNonCommentChild(children) {
    let child = children[0];
    if (children.length > 1) {
      for (const c of children) {
        if (c.type !== Comment) {
          child = c;
          break;
        }
      }
    }
    return child;
  }
  const BaseTransition = BaseTransitionImpl;
  function getLeavingNodesForType(state, vnode) {
    const { leavingVNodes } = state;
    let leavingVNodesCache = leavingVNodes.get(vnode.type);
    if (!leavingVNodesCache) {
      leavingVNodesCache = /* @__PURE__ */ Object.create(null);
      leavingVNodes.set(vnode.type, leavingVNodesCache);
    }
    return leavingVNodesCache;
  }
  function resolveTransitionHooks(vnode, props, state, instance) {
    const {
      appear,
      mode,
      persisted = false,
      onBeforeEnter,
      onEnter,
      onAfterEnter,
      onEnterCancelled,
      onBeforeLeave,
      onLeave,
      onAfterLeave,
      onLeaveCancelled,
      onBeforeAppear,
      onAppear,
      onAfterAppear,
      onAppearCancelled
    } = props;
    const key = String(vnode.key);
    const leavingVNodesCache = getLeavingNodesForType(state, vnode);
    const callHook2 = (hook, args) => {
      hook && callWithAsyncErrorHandling(
        hook,
        instance,
        9,
        args
      );
    };
    const callAsyncHook = (hook, args) => {
      const done = args[1];
      callHook2(hook, args);
      if (isArray(hook)) {
        if (hook.every((hook2) => hook2.length <= 1)) done();
      } else if (hook.length <= 1) {
        done();
      }
    };
    const hooks = {
      mode,
      persisted,
      beforeEnter(el) {
        let hook = onBeforeEnter;
        if (!state.isMounted) {
          if (appear) {
            hook = onBeforeAppear || onBeforeEnter;
          } else {
            return;
          }
        }
        if (el[leaveCbKey]) {
          el[leaveCbKey](
            true
            /* cancelled */
          );
        }
        const leavingVNode = leavingVNodesCache[key];
        if (leavingVNode && isSameVNodeType(vnode, leavingVNode)) {
          let leavingCb = leavingVNode.el[leaveCbKey];
          if (!leavingCb) {
            const leavingRoot = getTransitionRoot(leavingVNode);
            leavingCb = leavingRoot && leavingRoot.el[leaveCbKey];
          }
          if (leavingCb) {
            leavingCb();
          }
        }
        callHook2(hook, [el]);
      },
      enter(el) {
        if (leavingVNodesCache[key] === vnode) return;
        let hook = onEnter;
        let afterHook = onAfterEnter;
        let cancelHook = onEnterCancelled;
        if (!state.isMounted) {
          if (appear) {
            hook = onAppear || onEnter;
            afterHook = onAfterAppear || onAfterEnter;
            cancelHook = onAppearCancelled || onEnterCancelled;
          } else {
            return;
          }
        }
        let called = false;
        el[enterCbKey$1] = (cancelled) => {
          if (called) return;
          called = true;
          if (cancelled) {
            callHook2(cancelHook, [el]);
          } else {
            callHook2(afterHook, [el]);
          }
          if (hooks.delayedLeave) {
            hooks.delayedLeave();
          }
          el[enterCbKey$1] = void 0;
        };
        const done = el[enterCbKey$1].bind(null, false);
        if (hook) {
          callAsyncHook(hook, [el, done]);
        } else {
          done();
        }
      },
      leave(el, remove2) {
        const key2 = String(vnode.key);
        if (el[enterCbKey$1]) {
          el[enterCbKey$1](
            true
            /* cancelled */
          );
        }
        if (state.isUnmounting) {
          return remove2();
        }
        callHook2(onBeforeLeave, [el]);
        let called = false;
        el[leaveCbKey] = (cancelled) => {
          if (called) return;
          called = true;
          remove2();
          if (cancelled) {
            callHook2(onLeaveCancelled, [el]);
          } else {
            callHook2(onAfterLeave, [el]);
          }
          el[leaveCbKey] = void 0;
          if (leavingVNodesCache[key2] === vnode) {
            delete leavingVNodesCache[key2];
          }
        };
        const done = el[leaveCbKey].bind(null, false);
        leavingVNodesCache[key2] = vnode;
        if (onLeave) {
          callAsyncHook(onLeave, [el, done]);
        } else {
          done();
        }
      },
      clone(vnode2) {
        const cloned = resolveTransitionHooks(vnode2, props, state, instance);
        cloned.afterLeave = () => {
          if (hooks.afterLeave) hooks.afterLeave();
        };
        cloned.delayLeave = (el, earlyRemove, delayedLeave) => {
          if (hooks.delayLeave) {
            hooks.delayLeave(el, earlyRemove, delayedLeave);
          } else {
            delayedLeave();
          }
        };
        cloned.delayedLeave = () => {
          if (hooks.delayedLeave) hooks.delayedLeave();
        };
        return cloned;
      }
    };
    return hooks;
  }
  function emptyPlaceholder(vnode) {
    if (isKeepAlive(vnode)) {
      vnode = cloneVNode(vnode);
      vnode.children = null;
      return vnode;
    }
  }
  function getInnerChild$1(vnode) {
    if (!isKeepAlive(vnode)) {
      if (isTeleport(vnode.type) && vnode.children) {
        return findNonCommentChild(vnode.children);
      }
      return vnode;
    }
    if (vnode.component) {
      return vnode.component.subTree;
    }
    const { shapeFlag, children } = vnode;
    if (children) {
      if (shapeFlag & 16) {
        return children[0];
      }
      if (shapeFlag & 32 && isFunction(children.default)) {
        return children.default();
      }
    }
  }
  function setTransitionHooks(vnode, hooks) {
    if (vnode.shapeFlag & 6 && vnode.component) {
      vnode.transition = hooks;
      const subTree = vnode.component.subTree;
      setTransitionHooks(
        isTeleport(subTree.type) ? getInnerChild$1(subTree) || subTree : subTree,
        hooks
      );
    } else if (vnode.shapeFlag & 128) {
      const suspense = vnode.suspense;
      if (suspense) {
        const branch = suspense.isHydrating ? suspense.pendingBranch : suspense.activeBranch;
        if (branch) {
          setTransitionHooks(branch, hooks.clone(branch));
        }
      } else {
        vnode.ssContent.transition = hooks.clone(vnode.ssContent);
        vnode.ssFallback.transition = hooks.clone(vnode.ssFallback);
      }
    } else {
      vnode.transition = hooks;
      if (vnode.type === Fragment && isArray(vnode.children)) {
        const child = filterSingleRoot(vnode.children, false);
        if (child) {
          setTransitionHooks(child, hooks);
        }
      }
    }
  }
  function getTransitionRawChildren(children, keepComment = false, parentKey) {
    let ret = [];
    let keyedFragmentCount = 0;
    for (let i = 0; i < children.length; i++) {
      let child = children[i];
      const key = parentKey == null ? child.key : String(parentKey) + String(child.key != null ? child.key : i);
      if (child.type === Fragment) {
        if (child.patchFlag & 128) keyedFragmentCount++;
        ret = ret.concat(
          getTransitionRawChildren(child.children, keepComment, key)
        );
      } else if (keepComment || child.type !== Comment) {
        ret.push(key != null ? cloneVNode(child, { key }) : child);
      }
    }
    if (keyedFragmentCount > 1) {
      for (let i = 0; i < ret.length; i++) {
        ret[i].patchFlag = -2;
      }
    }
    return ret;
  }
  function getTransitionRoot(vnode) {
    if (vnode.component) {
      return getTransitionRoot(vnode.component.subTree);
    }
    if (vnode.type === Fragment) {
      const child = isArray(vnode.children) && filterSingleRoot(vnode.children, false);
      return child ? getTransitionRoot(child) : void 0;
    }
    if (vnode.type !== Comment) {
      return vnode;
    }
  }
  // @__NO_SIDE_EFFECTS__
  function defineComponent(options, extraOptions) {
    return isFunction(options) ? (
      // #8236: extend call and options.name access are considered side-effects
      // by Rollup, so we have to wrap it in a pure-annotated IIFE.
      /* @__PURE__ */ (() => extend({ name: options.name }, extraOptions, { setup: options }))()
    ) : options;
  }
  function useId() {
    const i = getCurrentInstance();
    if (i) {
      return (i.appContext.config.idPrefix || "v") + "-" + i.ids[0] + i.ids[1]++;
    }
    return "";
  }
  function markAsyncBoundary(instance) {
    instance.ids = [instance.ids[0] + instance.ids[2]++ + "-", 0, 0];
  }
  function useTemplateRef(key) {
    const i = getCurrentInstance();
    const r = /* @__PURE__ */ shallowRef(null);
    if (i) {
      const refs = i.refs === EMPTY_OBJ ? i.refs = {} : i.refs;
      {
        Object.defineProperty(refs, key, {
          enumerable: true,
          get: () => r.value,
          set: (val) => r.value = val
        });
      }
    }
    const ret = r;
    return ret;
  }
  function isTemplateRefKey(refs, key) {
    let desc;
    return !!((desc = Object.getOwnPropertyDescriptor(refs, key)) && !desc.configurable);
  }
  const pendingSetRefMap = /* @__PURE__ */ new WeakMap();
  function setRef(rawRef, oldRawRef, parentSuspense, vnode, isUnmount = false) {
    if (isArray(rawRef)) {
      rawRef.forEach(
        (r, i) => setRef(
          r,
          oldRawRef && (isArray(oldRawRef) ? oldRawRef[i] : oldRawRef),
          parentSuspense,
          vnode,
          isUnmount
        )
      );
      return;
    }
    if (isAsyncWrapper(vnode) && !isUnmount) {
      if (vnode.shapeFlag & 512 && vnode.type.__asyncResolved && vnode.component.subTree.component) {
        setRef(rawRef, oldRawRef, parentSuspense, vnode.component.subTree);
      }
      return;
    }
    const refValue = vnode.shapeFlag & 4 ? getComponentPublicInstance(vnode.component) : vnode.el;
    const value = isUnmount ? null : refValue;
    const { i: owner, r: ref3 } = rawRef;
    const oldRef = oldRawRef && oldRawRef.r;
    const refs = owner.refs === EMPTY_OBJ ? owner.refs = {} : owner.refs;
    const setupState = owner.setupState;
    const rawSetupState = /* @__PURE__ */ toRaw(setupState);
    const canSetSetupRef = setupState === EMPTY_OBJ ? NO : (key) => {
      if (isTemplateRefKey(refs, key)) {
        return false;
      }
      return hasOwn(rawSetupState, key);
    };
    const canSetRef = (ref22, key) => {
      if (key && isTemplateRefKey(refs, key)) {
        return false;
      }
      return true;
    };
    if (oldRef != null && oldRef !== ref3) {
      invalidatePendingSetRef(oldRawRef);
      if (isString(oldRef)) {
        refs[oldRef] = null;
        if (canSetSetupRef(oldRef)) {
          setupState[oldRef] = null;
        }
      } else if (/* @__PURE__ */ isRef(oldRef)) {
        const oldRawRefAtom = oldRawRef;
        if (canSetRef(oldRef, oldRawRefAtom.k)) {
          oldRef.value = null;
        }
        if (oldRawRefAtom.k) refs[oldRawRefAtom.k] = null;
      }
    }
    if (isFunction(ref3)) {
      callWithErrorHandling(ref3, owner, 12, [value, refs]);
    } else {
      const _isString = isString(ref3);
      const _isRef = /* @__PURE__ */ isRef(ref3);
      if (_isString || _isRef) {
        const doSet = () => {
          if (rawRef.f) {
            const existing = _isString ? canSetSetupRef(ref3) ? setupState[ref3] : refs[ref3] : canSetRef() || !rawRef.k ? ref3.value : refs[rawRef.k];
            if (isUnmount) {
              isArray(existing) && remove(existing, refValue);
            } else {
              if (!isArray(existing)) {
                if (_isString) {
                  refs[ref3] = [refValue];
                  if (canSetSetupRef(ref3)) {
                    setupState[ref3] = refs[ref3];
                  }
                } else {
                  const newVal = [refValue];
                  if (canSetRef(ref3, rawRef.k)) {
                    ref3.value = newVal;
                  }
                  if (rawRef.k) refs[rawRef.k] = newVal;
                }
              } else if (!existing.includes(refValue)) {
                existing.push(refValue);
              }
            }
          } else if (_isString) {
            refs[ref3] = value;
            if (canSetSetupRef(ref3)) {
              setupState[ref3] = value;
            }
          } else if (_isRef) {
            if (canSetRef(ref3, rawRef.k)) {
              ref3.value = value;
            }
            if (rawRef.k) refs[rawRef.k] = value;
          } else ;
        };
        if (value) {
          const job = () => {
            doSet();
            pendingSetRefMap.delete(rawRef);
          };
          job.id = -1;
          pendingSetRefMap.set(rawRef, job);
          queuePostRenderEffect(job, parentSuspense);
        } else {
          invalidatePendingSetRef(rawRef);
          doSet();
        }
      }
    }
  }
  function invalidatePendingSetRef(rawRef) {
    const pendingSetRef = pendingSetRefMap.get(rawRef);
    if (pendingSetRef) {
      pendingSetRef.flags |= 8;
      pendingSetRefMap.delete(rawRef);
    }
  }
  let hasLoggedMismatchError = false;
  const logMismatchError = () => {
    if (hasLoggedMismatchError) {
      return;
    }
    console.error("Hydration completed but contains mismatches.");
    hasLoggedMismatchError = true;
  };
  const isSVGContainer = (container) => container.namespaceURI.includes("svg") && container.tagName !== "foreignObject";
  const isMathMLContainer = (container) => container.namespaceURI.includes("MathML");
  const getContainerType = (container) => {
    if (container.nodeType !== 1) return void 0;
    if (isSVGContainer(container)) return "svg";
    if (isMathMLContainer(container)) return "mathml";
    return void 0;
  };
  const isComment = (node) => node.nodeType === 8;
  function createHydrationFunctions(rendererInternals) {
    const {
      mt: mountComponent,
      p: patch,
      o: {
        patchProp: patchProp2,
        createText,
        nextSibling,
        parentNode,
        remove: remove2,
        insert,
        createComment
      }
    } = rendererInternals;
    const hydrate2 = (vnode, container) => {
      if (!container.hasChildNodes()) {
        patch(null, vnode, container);
        flushPostFlushCbs();
        container._vnode = vnode;
        return;
      }
      hydrateNode(container.firstChild, vnode, null, null, null);
      flushPostFlushCbs();
      container._vnode = vnode;
    };
    const hydrateNode = (node, vnode, parentComponent, parentSuspense, slotScopeIds, optimized = false) => {
      optimized = optimized || !!vnode.dynamicChildren;
      const isFragmentStart = isComment(node) && node.data === "[";
      const onMismatch = () => handleMismatch(
        node,
        vnode,
        parentComponent,
        parentSuspense,
        slotScopeIds,
        isFragmentStart
      );
      const { type, ref: ref3, shapeFlag, patchFlag } = vnode;
      let domType = node.nodeType;
      vnode.el = node;
      if (patchFlag === -2) {
        optimized = false;
        vnode.dynamicChildren = null;
      }
      let nextNode = null;
      switch (type) {
        case Text:
          if (domType !== 3) {
            if (vnode.children === "") {
              insert(vnode.el = createText(""), parentNode(node), node);
              nextNode = node;
            } else {
              nextNode = onMismatch();
            }
          } else {
            if (node.data !== vnode.children) {
              logMismatchError();
              node.data = vnode.children;
            }
            nextNode = nextSibling(node);
          }
          break;
        case Comment:
          if (isTemplateNode(node)) {
            nextNode = nextSibling(node);
            replaceNode(
              vnode.el = node.content.firstChild,
              node,
              parentComponent
            );
          } else if (domType !== 8 || isFragmentStart) {
            nextNode = onMismatch();
          } else {
            nextNode = nextSibling(node);
          }
          break;
        case Static:
          if (isFragmentStart) {
            node = nextSibling(node);
            domType = node.nodeType;
          }
          if (domType === 1 || domType === 3) {
            nextNode = node;
            const needToAdoptContent = !vnode.children.length;
            for (let i = 0; i < vnode.staticCount; i++) {
              if (needToAdoptContent)
                vnode.children += nextNode.nodeType === 1 ? nextNode.outerHTML : nextNode.data;
              if (i === vnode.staticCount - 1) {
                vnode.anchor = nextNode;
              }
              nextNode = nextSibling(nextNode);
            }
            return isFragmentStart ? nextSibling(nextNode) : nextNode;
          } else {
            onMismatch();
          }
          break;
        case Fragment:
          if (!isFragmentStart) {
            nextNode = onMismatch();
          } else {
            nextNode = hydrateFragment(
              node,
              vnode,
              parentComponent,
              parentSuspense,
              slotScopeIds,
              optimized
            );
          }
          break;
        default:
          if (shapeFlag & 1) {
            if ((domType !== 1 || vnode.type.toLowerCase() !== node.tagName.toLowerCase()) && !isTemplateNode(node)) {
              nextNode = onMismatch();
            } else {
              nextNode = hydrateElement(
                node,
                vnode,
                parentComponent,
                parentSuspense,
                slotScopeIds,
                optimized
              );
            }
          } else if (shapeFlag & 6) {
            vnode.slotScopeIds = slotScopeIds;
            const container = parentNode(node);
            if (isFragmentStart) {
              nextNode = locateClosingAnchor(node);
            } else if (isComment(node) && node.data === "teleport start") {
              nextNode = locateClosingAnchor(node, node.data, "teleport end");
            } else {
              nextNode = nextSibling(node);
            }
            mountComponent(
              vnode,
              container,
              null,
              parentComponent,
              parentSuspense,
              getContainerType(container),
              optimized
            );
            if ((isAsyncWrapper(vnode) || vnode.component.asyncDep) && !vnode.component.subTree) {
              let subTree;
              if (isFragmentStart) {
                subTree = createVNode(Static);
                subTree.anchor = nextNode ? nextNode.previousSibling : container.lastChild;
              } else {
                subTree = node.nodeType === 3 ? createTextVNode("") : createVNode(
                  node.nodeType === 8 ? Comment : "div"
                );
              }
              subTree.el = node;
              vnode.component.subTree = subTree;
            }
          } else if (shapeFlag & 64) {
            if (domType !== 8) {
              nextNode = onMismatch();
            } else {
              nextNode = vnode.type.hydrate(
                node,
                vnode,
                parentComponent,
                parentSuspense,
                slotScopeIds,
                optimized,
                rendererInternals,
                hydrateChildren
              );
            }
          } else if (shapeFlag & 128) {
            nextNode = vnode.type.hydrate(
              node,
              vnode,
              parentComponent,
              parentSuspense,
              getContainerType(parentNode(node)),
              slotScopeIds,
              optimized,
              rendererInternals,
              hydrateNode
            );
          } else ;
      }
      if (ref3 != null) {
        setRef(ref3, null, parentSuspense, vnode);
      }
      return nextNode;
    };
    const hydrateElement = (el, vnode, parentComponent, parentSuspense, slotScopeIds, optimized) => {
      optimized = optimized || !!vnode.dynamicChildren;
      const {
        type,
        dynamicProps,
        props,
        patchFlag,
        shapeFlag,
        dirs,
        transition
      } = vnode;
      const forcePatch = type === "input" || type === "option";
      const hasDynamicProps = !!dynamicProps;
      if (forcePatch || hasDynamicProps || patchFlag !== -1) {
        if (dirs) {
          invokeDirectiveHook(vnode, null, parentComponent, "created");
        }
        let needCallTransitionHooks = false;
        if (isTemplateNode(el)) {
          needCallTransitionHooks = needTransition(
            null,
            // no need check parentSuspense in hydration
            transition
          ) && parentComponent && parentComponent.vnode.props && parentComponent.vnode.props.appear;
          const content = el.content.firstChild;
          if (needCallTransitionHooks) {
            const cls = content.getAttribute("class");
            if (cls) content.$cls = cls;
            transition.beforeEnter(content);
          }
          replaceNode(content, el, parentComponent);
          vnode.el = el = content;
        }
        if (shapeFlag & 16 && // skip if element has innerHTML / textContent
        !(props && (props.innerHTML || props.textContent))) {
          let next = hydrateChildren(
            el.firstChild,
            vnode,
            el,
            parentComponent,
            parentSuspense,
            slotScopeIds,
            optimized
          );
          if (next && !isMismatchAllowed(
            el,
            1
            /* CHILDREN */
          )) {
            logMismatchError();
          }
          while (next) {
            const cur = next;
            next = next.nextSibling;
            remove2(cur);
          }
        } else if (shapeFlag & 8) {
          let clientText = vnode.children;
          if (clientText[0] === "\n" && (el.tagName === "PRE" || el.tagName === "TEXTAREA")) {
            clientText = clientText.slice(1);
          }
          const { textContent } = el;
          if (textContent !== clientText && // innerHTML normalize \r\n or \r into a single \n in the DOM
          textContent !== clientText.replace(/\r\n|\r/g, "\n")) {
            if (!isMismatchAllowed(
              el,
              0
              /* TEXT */
            )) {
              logMismatchError();
            }
            el.textContent = vnode.children;
          }
        }
        if (props) {
          if (forcePatch || hasDynamicProps || !optimized || patchFlag & (16 | 32)) {
            const isCustomElement = el.tagName.includes("-");
            const namespace = el.namespaceURI.includes("svg") ? "svg" : el.namespaceURI.includes("MathML") ? "mathml" : void 0;
            for (const key in props) {
              if (forcePatch && (key.endsWith("value") || key === "indeterminate") || isOn(key) && !isReservedProp(key) || // force hydrate v-bind with .prop modifiers
              key[0] === "." || isCustomElement && !isReservedProp(key) || dynamicProps && dynamicProps.includes(key)) {
                if (isUnchangedResourceProp(el, key, props[key])) {
                  continue;
                }
                patchProp2(el, key, null, props[key], namespace, parentComponent);
              }
            }
          } else if (props.onClick) {
            patchProp2(
              el,
              "onClick",
              null,
              props.onClick,
              void 0,
              parentComponent
            );
          } else if (patchFlag & 4 && /* @__PURE__ */ isReactive(props.style)) {
            for (const key in props.style) props.style[key];
          }
        }
        let vnodeHooks;
        if (vnodeHooks = props && props.onVnodeBeforeMount) {
          invokeVNodeHook(vnodeHooks, parentComponent, vnode);
        }
        if (dirs) {
          invokeDirectiveHook(vnode, null, parentComponent, "beforeMount");
        }
        if ((vnodeHooks = props && props.onVnodeMounted) || dirs || needCallTransitionHooks) {
          queueEffectWithSuspense(() => {
            vnodeHooks && invokeVNodeHook(vnodeHooks, parentComponent, vnode);
            needCallTransitionHooks && transition.enter(el);
            dirs && invokeDirectiveHook(vnode, null, parentComponent, "mounted");
          }, parentSuspense);
        }
      }
      return el.nextSibling;
    };
    const hydrateChildren = (node, parentVNode, container, parentComponent, parentSuspense, slotScopeIds, optimized) => {
      optimized = optimized || !!parentVNode.dynamicChildren;
      const children = parentVNode.children;
      const l = children.length;
      let hasCheckedMismatch = false;
      for (let i = 0; i < l; i++) {
        const vnode = optimized ? children[i] : children[i] = normalizeVNode(children[i]);
        const isText = vnode.type === Text;
        if (node) {
          if (isText && !optimized) {
            if (i + 1 < l && normalizeVNode(children[i + 1]).type === Text) {
              insert(
                createText(
                  node.data.slice(vnode.children.length)
                ),
                container,
                nextSibling(node)
              );
              node.data = vnode.children;
            }
          }
          node = hydrateNode(
            node,
            vnode,
            parentComponent,
            parentSuspense,
            slotScopeIds,
            optimized
          );
        } else if (isText && !vnode.children) {
          insert(vnode.el = createText(""), container);
        } else {
          if (!hasCheckedMismatch) {
            hasCheckedMismatch = true;
            if (!isMismatchAllowed(
              container,
              1
              /* CHILDREN */
            )) {
              logMismatchError();
            }
          }
          patch(
            null,
            vnode,
            container,
            null,
            parentComponent,
            parentSuspense,
            getContainerType(container),
            slotScopeIds
          );
        }
      }
      return node;
    };
    const hydrateFragment = (node, vnode, parentComponent, parentSuspense, slotScopeIds, optimized) => {
      const { slotScopeIds: fragmentSlotScopeIds } = vnode;
      if (fragmentSlotScopeIds) {
        slotScopeIds = slotScopeIds ? slotScopeIds.concat(fragmentSlotScopeIds) : fragmentSlotScopeIds;
      }
      const container = parentNode(node);
      const next = hydrateChildren(
        nextSibling(node),
        vnode,
        container,
        parentComponent,
        parentSuspense,
        slotScopeIds,
        optimized
      );
      if (next && isComment(next) && next.data === "]") {
        return nextSibling(vnode.anchor = next);
      } else {
        logMismatchError();
        insert(vnode.anchor = createComment(`]`), container, next);
        return next;
      }
    };
    const handleMismatch = (node, vnode, parentComponent, parentSuspense, slotScopeIds, isFragment) => {
      if (!isNodeMismatchAllowed(node, vnode)) {
        logMismatchError();
      }
      vnode.el = null;
      if (isFragment) {
        const end = locateClosingAnchor(node);
        while (true) {
          const next2 = nextSibling(node);
          if (next2 && next2 !== end) {
            remove2(next2);
          } else {
            break;
          }
        }
      }
      const next = nextSibling(node);
      const container = parentNode(node);
      remove2(node);
      patch(
        null,
        vnode,
        container,
        next,
        parentComponent,
        parentSuspense,
        getContainerType(container),
        slotScopeIds
      );
      if (parentComponent && parentComponent.vnode.el === node) {
        parentComponent.vnode.el = vnode.el;
        updateHOCHostEl(parentComponent, vnode.el);
      }
      return next;
    };
    const locateClosingAnchor = (node, open = "[", close = "]") => {
      let match = 0;
      while (node) {
        node = nextSibling(node);
        if (node && isComment(node)) {
          if (node.data === open) match++;
          if (node.data === close) {
            if (match === 0) {
              return nextSibling(node);
            } else {
              match--;
            }
          }
        }
      }
      return node;
    };
    const replaceNode = (newNode, oldNode, parentComponent) => {
      const parentNode2 = oldNode.parentNode;
      if (parentNode2) {
        parentNode2.replaceChild(newNode, oldNode);
      }
      let parent = parentComponent;
      while (parent) {
        if (parent.vnode.el === oldNode) {
          parent.vnode.el = parent.subTree.el = newNode;
        }
        parent = parent.parent;
      }
    };
    const isTemplateNode = (node) => {
      return node.nodeType === 1 && node.tagName === "TEMPLATE";
    };
    return [hydrate2, hydrateNode];
  }
  const resourceProps = /* @__PURE__ */ new Set(["src", "srcset", "href", "poster"]);
  function isUnchangedResourceProp(el, key, clientValue) {
    if (!resourceProps.has(key)) {
      return false;
    }
    return el.getAttribute(key) === (clientValue == null ? null : `${clientValue}`);
  }
  const allowMismatchAttr = "data-allow-mismatch";
  const MismatchTypeString = {
    [
      0
      /* TEXT */
    ]: "text",
    [
      1
      /* CHILDREN */
    ]: "children",
    [
      2
      /* CLASS */
    ]: "class",
    [
      3
      /* STYLE */
    ]: "style",
    [
      4
      /* ATTRIBUTE */
    ]: "attribute"
  };
  function isMismatchAllowed(el, allowedType) {
    if (allowedType === 0 || allowedType === 1) {
      while (el && !el.hasAttribute(allowMismatchAttr)) {
        el = el.parentElement;
      }
    }
    return isMismatchAllowedByAttr(
      el && el.getAttribute(allowMismatchAttr),
      allowedType
    );
  }
  function isMismatchAllowedByAttr(allowedAttr, allowedType) {
    if (allowedAttr == null) {
      return false;
    } else if (allowedAttr === "") {
      return true;
    } else {
      const list = allowedAttr.split(",");
      if (allowedType === 0 && list.includes("children")) {
        return true;
      }
      return list.includes(MismatchTypeString[allowedType]);
    }
  }
  function isNodeMismatchAllowed(node, vnode) {
    return isMismatchAllowed(
      node.parentElement,
      1
      /* CHILDREN */
    ) || isMismatchAllowedByNode(node) || isMismatchAllowedByVNode(vnode);
  }
  function isMismatchAllowedByNode(node) {
    return node.nodeType === 1 && isMismatchAllowedByAttr(
      node.getAttribute(allowMismatchAttr),
      1
      /* CHILDREN */
    );
  }
  function isMismatchAllowedByVNode({ props }) {
    const allowedAttr = props && props[allowMismatchAttr];
    return typeof allowedAttr === "string" && isMismatchAllowedByAttr(
      allowedAttr,
      1
      /* CHILDREN */
    );
  }
  const requestIdleCallback = getGlobalThis().requestIdleCallback || ((cb) => setTimeout(cb, 1));
  const cancelIdleCallback = getGlobalThis().cancelIdleCallback || ((id) => clearTimeout(id));
  const hydrateOnIdle = (timeout = 1e4) => (hydrate2) => {
    const id = requestIdleCallback(hydrate2, { timeout });
    return () => cancelIdleCallback(id);
  };
  function elementIsVisibleInViewport(el) {
    const { top, left, bottom, right } = el.getBoundingClientRect();
    const { innerHeight, innerWidth } = window;
    return (top > 0 && top < innerHeight || bottom > 0 && bottom < innerHeight) && (left > 0 && left < innerWidth || right > 0 && right < innerWidth);
  }
  const hydrateOnVisible = (opts) => (hydrate2, forEach) => {
    const ob = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        ob.disconnect();
        hydrate2();
        break;
      }
    }, opts);
    const observe = (el) => {
      if (elementIsVisibleInViewport(el)) {
        hydrate2();
        ob.disconnect();
        return false;
      }
      if (getComputedStyle(el).display === "contents") {
        for (let i = 0; i < el.children.length; i++) {
          if (observe(el.children[i]) === false) return false;
        }
      }
      ob.observe(el);
    };
    forEach((el) => {
      if (!(el instanceof Element)) return;
      return observe(el);
    });
    return () => ob.disconnect();
  };
  const hydrateOnMediaQuery = (query2) => (hydrate2) => {
    if (query2) {
      const mql = matchMedia(query2);
      if (mql.matches) {
        hydrate2();
      } else {
        mql.addEventListener("change", hydrate2, { once: true });
        return () => mql.removeEventListener("change", hydrate2);
      }
    }
  };
  const hydrateOnInteraction = (interactions = []) => (hydrate2, forEach) => {
    if (isString(interactions)) interactions = [interactions];
    let hasHydrated = false;
    const doHydrate = (e) => {
      if (!hasHydrated) {
        hasHydrated = true;
        teardown();
        hydrate2();
        e.target.dispatchEvent(new e.constructor(e.type, e));
      }
    };
    const teardown = () => {
      forEach((el) => {
        for (const i of interactions) {
          el.removeEventListener(i, doHydrate);
        }
      });
    };
    forEach((el) => {
      for (const i of interactions) {
        el.addEventListener(i, doHydrate, { once: true });
      }
    });
    return teardown;
  };
  function forEachElement(node, cb) {
    if (isComment(node) && node.data === "[") {
      let depth = 1;
      let next = node.nextSibling;
      while (next) {
        if (next.nodeType === 1) {
          const result = cb(next);
          if (result === false) {
            break;
          }
        } else if (isComment(next)) {
          if (next.data === "]") {
            if (--depth === 0) break;
          } else if (next.data === "[") {
            depth++;
          }
        }
        next = next.nextSibling;
      }
    } else {
      cb(node);
    }
  }
  const isAsyncWrapper = (i) => !!i.type.__asyncLoader;
  // @__NO_SIDE_EFFECTS__
  function defineAsyncComponent(source) {
    if (isFunction(source)) {
      source = { loader: source };
    }
    const {
      loader,
      loadingComponent,
      errorComponent,
      delay = 200,
      hydrate: hydrateStrategy,
      timeout,
      // undefined = never times out
      suspensible = true,
      onError: userOnError
    } = source;
    let pendingRequest = null;
    let resolvedComp;
    let retries = 0;
    const retry = () => {
      retries++;
      pendingRequest = null;
      return load();
    };
    const load = () => {
      let thisRequest;
      return pendingRequest || (thisRequest = pendingRequest = loader().catch((err) => {
        err = err instanceof Error ? err : new Error(String(err));
        if (userOnError) {
          return new Promise((resolve2, reject) => {
            const userRetry = () => resolve2(retry());
            const userFail = () => reject(err);
            userOnError(err, userRetry, userFail, retries + 1);
          });
        } else {
          throw err;
        }
      }).then((comp) => {
        if (thisRequest !== pendingRequest && pendingRequest) {
          return pendingRequest;
        }
        if (comp && (comp.__esModule || comp[Symbol.toStringTag] === "Module")) {
          comp = comp.default;
        }
        resolvedComp = comp;
        return comp;
      }));
    };
    return /* @__PURE__ */ defineComponent({
      name: "AsyncComponentWrapper",
      __asyncLoader: load,
      __asyncHydrate(el, instance, hydrate2) {
        const wasConnected = el.isConnected;
        let patched = false;
        (instance.bu || (instance.bu = [])).push(() => patched = true);
        const performHydrate = () => {
          if (patched) {
            return;
          }
          if (!el.parentNode || wasConnected && !el.isConnected) return;
          hydrate2();
        };
        const doHydrate = hydrateStrategy ? () => {
          const teardown = hydrateStrategy(
            performHydrate,
            (cb) => forEachElement(el, cb)
          );
          if (teardown) {
            (instance.bum || (instance.bum = [])).push(teardown);
          }
        } : performHydrate;
        if (resolvedComp) {
          doHydrate();
        } else {
          load().then(() => !instance.isUnmounted && doHydrate());
        }
      },
      get __asyncResolved() {
        return resolvedComp;
      },
      setup() {
        const instance = currentInstance;
        markAsyncBoundary(instance);
        if (resolvedComp) {
          return () => createInnerComp(resolvedComp, instance);
        }
        const onError = (err) => {
          pendingRequest = null;
          handleError(
            err,
            instance,
            13,
            !errorComponent,
            true
          );
        };
        if (suspensible && instance.suspense || isInSSRComponentSetup) {
          return load().then((comp) => {
            return () => createInnerComp(comp, instance);
          }).catch((err) => {
            onError(err);
            return () => errorComponent ? createVNode(errorComponent, {
              error: err
            }) : null;
          });
        }
        const loaded = /* @__PURE__ */ ref$j(false);
        const error = /* @__PURE__ */ ref$j();
        const delayed = /* @__PURE__ */ ref$j(!!delay);
        let timeoutTimer;
        let delayTimer;
        onScopeDispose(() => {
          if (timeoutTimer != null) clearTimeout(timeoutTimer);
          if (delayTimer != null) clearTimeout(delayTimer);
        });
        if (delay) {
          delayTimer = setTimeout(() => {
            if (instance.isUnmounted) return;
            delayed.value = false;
          }, delay);
        }
        if (timeout != null) {
          timeoutTimer = setTimeout(() => {
            if (instance.isUnmounted) return;
            if (!loaded.value && !error.value) {
              const err = new Error(
                `Async component timed out after ${timeout}ms.`
              );
              onError(err);
              error.value = err;
            }
          }, timeout);
        }
        load().then(() => {
          if (instance.isUnmounted) return;
          loaded.value = true;
          if (instance.parent && isKeepAlive(instance.parent.vnode)) {
            instance.parent.update();
          }
        }).catch((err) => {
          if (instance.isUnmounted) {
            pendingRequest = null;
            return;
          }
          onError(err);
          error.value = err;
        });
        return () => {
          if (loaded.value && resolvedComp) {
            return createInnerComp(resolvedComp, instance);
          } else if (error.value && errorComponent) {
            return createVNode(errorComponent, {
              error: error.value
            });
          } else if (loadingComponent && !delayed.value) {
            return createInnerComp(
              loadingComponent,
              instance
            );
          }
        };
      }
    });
  }
  function createInnerComp(comp, parent) {
    const { ref: ref22, props, children, ce } = parent.vnode;
    const vnode = createVNode(comp, props, children);
    vnode.ref = ref22;
    vnode.ce = ce;
    delete parent.vnode.ce;
    return vnode;
  }
  const isKeepAlive = (vnode) => vnode.type.__isKeepAlive;
  const KeepAliveImpl = {
    name: `KeepAlive`,
    // Marker for special handling inside the renderer. We are not using a ===
    // check directly on KeepAlive in the renderer, because importing it directly
    // would prevent it from being tree-shaken.
    __isKeepAlive: true,
    props: {
      include: [String, RegExp, Array],
      exclude: [String, RegExp, Array],
      max: [String, Number]
    },
    setup(props, { slots }) {
      const instance = getCurrentInstance();
      const sharedContext = instance.ctx;
      if (!sharedContext.renderer) {
        return () => {
          const children = slots.default && slots.default();
          return children && children.length === 1 ? children[0] : children;
        };
      }
      const cache = /* @__PURE__ */ new Map();
      const keys = /* @__PURE__ */ new Set();
      let current = null;
      const parentSuspense = instance.suspense;
      const {
        renderer: {
          p: patch,
          m: move,
          um: _unmount,
          o: { createElement }
        }
      } = sharedContext;
      const storageContainer = createElement("div");
      sharedContext.activate = (vnode, container, anchor, namespace, optimized) => {
        const instance2 = vnode.component;
        move(vnode, container, anchor, 0, parentSuspense);
        patch(
          instance2.vnode,
          vnode,
          container,
          anchor,
          instance2,
          parentSuspense,
          namespace,
          vnode.slotScopeIds,
          optimized
        );
        queuePostRenderEffect(() => {
          instance2.isDeactivated = false;
          if (instance2.a) {
            invokeArrayFns(instance2.a);
          }
          const vnodeHook = vnode.props && vnode.props.onVnodeMounted;
          if (vnodeHook) {
            invokeVNodeHook(vnodeHook, instance2.parent, vnode);
          }
        }, parentSuspense);
      };
      sharedContext.deactivate = (vnode) => {
        const cached = cache.get(
          vnode.key == null ? vnode.type : vnode.key
        );
        if (!cached || cached.component !== vnode.component) {
          return false;
        }
        const instance2 = vnode.component;
        invalidateMount(instance2.m);
        invalidateMount(instance2.a);
        move(vnode, storageContainer, null, 1, parentSuspense);
        queuePostRenderEffect(() => {
          if (instance2.da) {
            invokeArrayFns(instance2.da);
          }
          const vnodeHook = vnode.props && vnode.props.onVnodeUnmounted;
          if (vnodeHook) {
            invokeVNodeHook(vnodeHook, instance2.parent, vnode);
          }
          instance2.isDeactivated = true;
        }, parentSuspense);
        return true;
      };
      function unmount(vnode) {
        resetShapeFlag(vnode);
        _unmount(vnode, instance, parentSuspense, true);
      }
      function pruneCache(filter) {
        cache.forEach((vnode, key) => {
          const name = getComponentName(
            isAsyncWrapper(vnode) ? vnode.type.__asyncResolved || {} : vnode.type
          );
          if (name && !filter(name)) {
            pruneCacheEntry(key);
          }
        });
      }
      function pruneCacheEntry(key) {
        const cached = cache.get(key);
        if (cached && (!current || !isSameVNodeType(cached, current))) {
          unmount(cached);
        } else if (current) {
          resetShapeFlag(current);
          if (cached) resetShapeFlag(cached);
        }
        cache.delete(key);
        keys.delete(key);
      }
      watch$e(
        () => [props.include, props.exclude],
        ([include, exclude]) => {
          include && pruneCache((name) => matches(include, name));
          exclude && pruneCache((name) => !matches(exclude, name));
        },
        // prune post-render after `current` has been updated
        { flush: "post", deep: true }
      );
      let pendingCacheKey = null;
      const cacheSubtree = () => {
        if (pendingCacheKey != null) {
          if (isSuspense(instance.subTree.type)) {
            const cacheInnerChild = () => {
              const vnode = getInnerChild(instance.subTree);
              if (vnode.component) {
                cache.set(pendingCacheKey, vnode);
              }
            };
            if (instance.subTree.suspense.pendingBranch) {
              queuePostRenderEffect(cacheInnerChild, instance.subTree.suspense);
            } else {
              cacheInnerChild();
            }
          } else {
            cache.set(pendingCacheKey, getInnerChild(instance.subTree));
          }
        }
      };
      onMounted$d(cacheSubtree);
      onUpdated(cacheSubtree);
      onBeforeUnmount$2(() => {
        cache.forEach((cached) => {
          const { subTree, suspense } = instance;
          const vnode = getInnerChild(subTree);
          if (cached.type === vnode.type && cached.key === vnode.key) {
            resetShapeFlag(vnode);
            const da = vnode.component.da;
            da && queuePostRenderEffect(da, suspense);
            return;
          }
          unmount(cached);
        });
      });
      return () => {
        pendingCacheKey = null;
        if (!slots.default) {
          return current = null;
        }
        const children = slots.default();
        const rawVNode = children[0];
        if (children.length > 1) {
          current = null;
          return children;
        } else if (!isVNode(rawVNode) || !(rawVNode.shapeFlag & 4) && !(rawVNode.shapeFlag & 128)) {
          current = null;
          return rawVNode;
        }
        let vnode = getInnerChild(rawVNode);
        if (vnode.type === Comment) {
          current = null;
          return vnode;
        }
        const comp = vnode.type;
        const name = getComponentName(
          isAsyncWrapper(vnode) ? vnode.type.__asyncResolved || {} : comp
        );
        const { include, exclude, max } = props;
        if (include && (!name || !matches(include, name)) || exclude && name && matches(exclude, name)) {
          vnode.shapeFlag &= -257;
          current = vnode;
          return rawVNode;
        }
        const key = vnode.key == null ? comp : vnode.key;
        const cachedVNode = cache.get(key);
        if (vnode.el) {
          vnode = cloneVNode(vnode);
          if (rawVNode.shapeFlag & 128) {
            rawVNode.ssContent = vnode;
          }
        }
        pendingCacheKey = key;
        if (cachedVNode) {
          vnode.el = cachedVNode.el;
          vnode.component = cachedVNode.component;
          if (vnode.transition) {
            setTransitionHooks(vnode, vnode.transition);
          }
          vnode.shapeFlag |= 512;
          keys.delete(key);
          keys.add(key);
        } else {
          keys.add(key);
          if (max && keys.size > parseInt(max, 10)) {
            pruneCacheEntry(keys.values().next().value);
          }
        }
        vnode.shapeFlag |= 256;
        current = vnode;
        return isSuspense(rawVNode.type) ? rawVNode : vnode;
      };
    }
  };
  const KeepAlive = KeepAliveImpl;
  function matches(pattern, name) {
    if (isArray(pattern)) {
      return pattern.some((p2) => matches(p2, name));
    } else if (isString(pattern)) {
      return pattern.split(",").includes(name);
    } else if (isRegExp(pattern)) {
      pattern.lastIndex = 0;
      return pattern.test(name);
    }
    return false;
  }
  function onActivated(hook, target) {
    registerKeepAliveHook(hook, "a", target);
  }
  function onDeactivated(hook, target) {
    registerKeepAliveHook(hook, "da", target);
  }
  function registerKeepAliveHook(hook, type, target = currentInstance) {
    const wrappedHook = hook.__wdc || (hook.__wdc = () => {
      let current = target;
      while (current) {
        if (current.isDeactivated) {
          return;
        }
        current = current.parent;
      }
      return hook();
    });
    injectHook(type, wrappedHook, target);
    if (target) {
      let current = target.parent;
      while (current && current.parent) {
        if (isKeepAlive(current.parent.vnode)) {
          injectToKeepAliveRoot(wrappedHook, type, target, current);
        }
        current = current.parent;
      }
    }
  }
  function injectToKeepAliveRoot(hook, type, target, keepAliveRoot) {
    const injected = injectHook(
      type,
      hook,
      keepAliveRoot,
      true
      /* prepend */
    );
    const removal = injectHook(
      "um",
      () => remove(keepAliveRoot[type], injected),
      target
    );
    removal.flags = 16;
  }
  function resetShapeFlag(vnode) {
    vnode.shapeFlag &= -257;
    vnode.shapeFlag &= -513;
  }
  function getInnerChild(vnode) {
    return vnode.shapeFlag & 128 ? vnode.ssContent : vnode;
  }
  function injectHook(type, hook, target = currentInstance, prepend = false) {
    if (target) {
      const hooks = target[type] || (target[type] = []);
      const wrappedHook = hook.__weh || (hook.__weh = (...args) => {
        pauseTracking();
        const reset = setCurrentInstance(target);
        const res = callWithAsyncErrorHandling(hook, target, type, args);
        reset();
        resetTracking();
        return res;
      });
      if (prepend) {
        hooks.unshift(wrappedHook);
      } else {
        hooks.push(wrappedHook);
      }
      return wrappedHook;
    }
  }
  const createHook = (lifecycle) => (hook, target = currentInstance) => {
    if (!isInSSRComponentSetup || lifecycle === "sp") {
      injectHook(lifecycle, (...args) => hook(...args), target);
    }
  };
  const onBeforeMount = createHook("bm");
  const onMounted$d = createHook("m");
  const onBeforeUpdate = createHook(
    "bu"
  );
  const onUpdated = createHook("u");
  const onBeforeUnmount$2 = createHook(
    "bum"
  );
  const onUnmounted$9 = createHook("um");
  const onServerPrefetch = createHook(
    "sp"
  );
  const onRenderTriggered = createHook("rtg");
  const onRenderTracked = createHook("rtc");
  function onErrorCaptured(hook, target = currentInstance) {
    injectHook("ec", hook, target);
  }
  const COMPONENTS = "components";
  const DIRECTIVES = "directives";
  function resolveComponent(name, maybeSelfReference) {
    return resolveAsset(COMPONENTS, name, true, maybeSelfReference) || name;
  }
  const NULL_DYNAMIC_COMPONENT = /* @__PURE__ */ Symbol.for("v-ndc");
  function resolveDynamicComponent(component) {
    if (isString(component)) {
      return resolveAsset(COMPONENTS, component, false) || component;
    } else {
      return component || NULL_DYNAMIC_COMPONENT;
    }
  }
  function resolveDirective(name) {
    return resolveAsset(DIRECTIVES, name);
  }
  function resolveAsset(type, name, warnMissing = true, maybeSelfReference = false) {
    const instance = currentRenderingInstance || currentInstance;
    if (instance) {
      const Component = instance.type;
      if (type === COMPONENTS) {
        const selfName = getComponentName(
          Component,
          false
        );
        if (selfName && (selfName === name || selfName === camelize(name) || selfName === capitalize(camelize(name)))) {
          return Component;
        }
      }
      const res = (
        // local registration
        // check instance[type] first which is resolved for options API
        resolve(instance[type] || Component[type], name) || // global registration
        resolve(instance.appContext[type], name)
      );
      if (!res && maybeSelfReference) {
        return Component;
      }
      return res;
    }
  }
  function resolve(registry, name) {
    return registry && (registry[name] || registry[camelize(name)] || registry[capitalize(camelize(name))]);
  }
  function renderList(source, renderItem, cache, index) {
    let ret;
    const cached = cache && cache[index];
    const sourceIsArray = isArray(source);
    if (sourceIsArray || isString(source)) {
      const sourceIsReactiveArray = sourceIsArray && /* @__PURE__ */ isReactive(source);
      let needsWrap = false;
      let isReadonlySource = false;
      if (sourceIsReactiveArray) {
        needsWrap = !/* @__PURE__ */ isShallow(source);
        isReadonlySource = /* @__PURE__ */ isReadonly(source);
        source = shallowReadArray(source);
      }
      ret = new Array(source.length);
      for (let i = 0, l = source.length; i < l; i++) {
        ret[i] = renderItem(
          needsWrap ? isReadonlySource ? toReadonly(toReactive(source[i])) : toReactive(source[i]) : source[i],
          i,
          void 0,
          cached && cached[i]
        );
      }
    } else if (typeof source === "number") {
      if (!Number.isInteger(source) || source < 0) {
        ret = [];
      } else {
        ret = new Array(source);
        for (let i = 0; i < source; i++) {
          ret[i] = renderItem(i + 1, i, void 0, cached && cached[i]);
        }
      }
    } else if (isObject(source)) {
      if (source[Symbol.iterator]) {
        ret = Array.from(
          source,
          (item, i) => renderItem(item, i, void 0, cached && cached[i])
        );
      } else {
        const keys = Object.keys(source);
        ret = new Array(keys.length);
        for (let i = 0, l = keys.length; i < l; i++) {
          const key = keys[i];
          ret[i] = renderItem(source[key], key, i, cached && cached[i]);
        }
      }
    } else {
      ret = [];
    }
    if (cache) {
      cache[index] = ret;
    }
    return ret;
  }
  function createSlots(slots, dynamicSlots) {
    for (let i = 0; i < dynamicSlots.length; i++) {
      const slot = dynamicSlots[i];
      if (isArray(slot)) {
        for (let j = 0; j < slot.length; j++) {
          slots[slot[j].name] = slot[j].fn;
        }
      } else if (slot) {
        slots[slot.name] = slot.key ? (...args) => {
          const res = slot.fn(...args);
          if (res) res.key = slot.key;
          return res;
        } : slot.fn;
      }
    }
    return slots;
  }
  function renderSlot(slots, name, props, fallback, noSlotted, branchKey) {
    if (props == null) props = {};
    if (currentRenderingInstance.ce || currentRenderingInstance.parent && isAsyncWrapper(currentRenderingInstance.parent) && currentRenderingInstance.parent.ce) {
      const slotProps = branchKey != null && props.key == null ? extend({}, props, { key: branchKey }) : props;
      const hasProps = Object.keys(slotProps).length > 0;
      if (name !== "default") slotProps.name = name;
      return openBlock(), createBlock(
        Fragment,
        null,
        [createVNode("slot", slotProps, fallback && fallback())],
        hasProps ? -2 : 64
      );
    }
    let slot = slots[name];
    if (slot && slot._c) {
      slot._d = false;
    }
    const prevStackSize = blockStack.length;
    openBlock();
    let rendered;
    try {
      const validSlotContent = slot && ensureValidVNode(slot(props));
      const slotKey = props.key || branchKey || // slot content array of a dynamic conditional slot may have a branch
      // key attached in the `createSlots` helper, respect that
      validSlotContent && validSlotContent.key;
      rendered = createBlock(
        Fragment,
        {
          key: (slotKey && !isSymbol(slotKey) ? slotKey : `_${name}`) + // #7256 force differentiate fallback content from actual content
          (!validSlotContent && fallback ? "_fb" : "")
        },
        validSlotContent || (fallback ? fallback() : []),
        validSlotContent && slots._ === 1 ? 64 : -2
      );
    } catch (err) {
      for (let i = blockStack.length; i > prevStackSize; i--) closeBlock();
      throw err;
    } finally {
      if (slot && slot._c) {
        slot._d = true;
      }
    }
    if (!noSlotted && rendered.scopeId) {
      rendered.slotScopeIds = [rendered.scopeId + "-s"];
    }
    return rendered;
  }
  function ensureValidVNode(vnodes) {
    return vnodes.some((child) => {
      if (!isVNode(child)) return true;
      if (child.type === Comment) return false;
      if (child.type === Fragment && !ensureValidVNode(child.children))
        return false;
      return true;
    }) ? vnodes : null;
  }
  function toHandlers(obj, preserveCaseIfNecessary) {
    const ret = {};
    for (const key in obj) {
      ret[preserveCaseIfNecessary && /[A-Z]/.test(key) ? `on:${key}` : toHandlerKey(key)] = obj[key];
    }
    return ret;
  }
  const getPublicInstance = (i) => {
    if (!i) return null;
    if (isStatefulComponent(i)) return getComponentPublicInstance(i);
    return getPublicInstance(i.parent);
  };
  const publicPropertiesMap = (
    // Move PURE marker to new line to workaround compiler discarding it
    // due to type annotation
    /* @__PURE__ */ extend(/* @__PURE__ */ Object.create(null), {
      $: (i) => i,
      $el: (i) => i.vnode.el,
      $data: (i) => i.data,
      $props: (i) => i.props,
      $attrs: (i) => i.attrs,
      $slots: (i) => i.slots,
      $refs: (i) => i.refs,
      $parent: (i) => getPublicInstance(i.parent),
      $root: (i) => getPublicInstance(i.root),
      $host: (i) => i.ce,
      $emit: (i) => i.emit,
      $options: (i) => resolveMergedOptions(i),
      $forceUpdate: (i) => i.f || (i.f = () => {
        queueJob(i.update);
      }),
      $nextTick: (i) => i.n || (i.n = nextTick$2.bind(i.proxy)),
      $watch: (i) => instanceWatch.bind(i)
    })
  );
  const hasSetupBinding = (state, key) => state !== EMPTY_OBJ && !state.__isScriptSetup && hasOwn(state, key);
  const PublicInstanceProxyHandlers = {
    get({ _: instance }, key) {
      if (key === "__v_skip") {
        return true;
      }
      const { ctx, setupState, data, props, accessCache, type, appContext } = instance;
      if (key[0] !== "$") {
        const n = accessCache[key];
        if (n !== void 0) {
          switch (n) {
            case 1:
              return setupState[key];
            case 2:
              return data[key];
            case 4:
              return ctx[key];
            case 3:
              return props[key];
          }
        } else if (hasSetupBinding(setupState, key)) {
          accessCache[key] = 1;
          return setupState[key];
        } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
          accessCache[key] = 2;
          return data[key];
        } else if (hasOwn(props, key)) {
          accessCache[key] = 3;
          return props[key];
        } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
          accessCache[key] = 4;
          return ctx[key];
        } else if (shouldCacheAccess) {
          accessCache[key] = 0;
        }
      }
      const publicGetter = publicPropertiesMap[key];
      let cssModule, globalProperties;
      if (publicGetter) {
        if (key === "$attrs") {
          track(instance.attrs, "get", "");
        }
        return publicGetter(instance);
      } else if (
        // css module (injected by vue-loader)
        (cssModule = type.__cssModules) && (cssModule = cssModule[key])
      ) {
        return cssModule;
      } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
        accessCache[key] = 4;
        return ctx[key];
      } else if (
        // global properties
        globalProperties = appContext.config.globalProperties, hasOwn(globalProperties, key)
      ) {
        {
          return globalProperties[key];
        }
      } else ;
    },
    set({ _: instance }, key, value) {
      const { data, setupState, ctx } = instance;
      if (hasSetupBinding(setupState, key)) {
        setupState[key] = value;
        return true;
      } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
        data[key] = value;
        return true;
      } else if (hasOwn(instance.props, key)) {
        return false;
      }
      if (key[0] === "$" && key.slice(1) in instance) {
        return false;
      } else {
        {
          ctx[key] = value;
        }
      }
      return true;
    },
    has({
      _: { data, setupState, accessCache, ctx, appContext, props, type }
    }, key) {
      let cssModules;
      return !!(accessCache[key] || data !== EMPTY_OBJ && key[0] !== "$" && hasOwn(data, key) || hasSetupBinding(setupState, key) || hasOwn(props, key) || hasOwn(ctx, key) || hasOwn(publicPropertiesMap, key) || hasOwn(appContext.config.globalProperties, key) || (cssModules = type.__cssModules) && cssModules[key]);
    },
    defineProperty(target, key, descriptor) {
      if (descriptor.get != null) {
        target._.accessCache[key] = 0;
      } else if (hasOwn(descriptor, "value")) {
        this.set(target, key, descriptor.value, null);
      }
      return Reflect.defineProperty(target, key, descriptor);
    }
  };
  const RuntimeCompiledPublicInstanceProxyHandlers = /* @__PURE__ */ extend({}, PublicInstanceProxyHandlers, {
    get(target, key) {
      if (key === Symbol.unscopables) {
        return;
      }
      return PublicInstanceProxyHandlers.get(target, key, target);
    },
    has(_, key) {
      const has = key[0] !== "_" && !isGloballyAllowed(key);
      return has;
    }
  });
  function defineProps() {
    return null;
  }
  function defineEmits() {
    return null;
  }
  function defineExpose(exposed) {
  }
  function defineOptions(options) {
  }
  function defineSlots() {
    return null;
  }
  function defineModel() {
  }
  function withDefaults(props, defaults) {
    return null;
  }
  function useSlots() {
    return getContext().slots;
  }
  function useAttrs() {
    return getContext().attrs;
  }
  function getContext(calledFunctionName) {
    const i = getCurrentInstance();
    return i.setupContext || (i.setupContext = createSetupContext(i));
  }
  function normalizePropsOrEmits(props) {
    return isArray(props) ? props.reduce(
      (normalized, p2) => (normalized[p2] = null, normalized),
      {}
    ) : props;
  }
  function mergeDefaults(raw, defaults) {
    const props = normalizePropsOrEmits(raw);
    for (const key in defaults) {
      if (key.startsWith("__skip")) continue;
      let opt = props[key];
      if (opt) {
        if (isArray(opt) || isFunction(opt)) {
          opt = props[key] = { type: opt, default: defaults[key] };
        } else {
          opt.default = defaults[key];
        }
      } else if (opt === null) {
        opt = props[key] = { default: defaults[key] };
      } else ;
      if (opt && defaults[`__skip_${key}`]) {
        opt.skipFactory = true;
      }
    }
    return props;
  }
  function mergeModels(a, b) {
    if (!a || !b) return a || b;
    if (isArray(a) && isArray(b)) return a.concat(b);
    return extend({}, normalizePropsOrEmits(a), normalizePropsOrEmits(b));
  }
  function createPropsRestProxy(props, excludedKeys) {
    const ret = {};
    for (const key in props) {
      if (!excludedKeys.includes(key)) {
        Object.defineProperty(ret, key, {
          enumerable: true,
          get: () => props[key]
        });
      }
    }
    return ret;
  }
  function withAsyncContext(getAwaitable) {
    const ctx = getCurrentInstance();
    const inSSRSetup = isInSSRComponentSetup;
    let awaitable = getAwaitable();
    unsetCurrentInstance();
    if (inSSRSetup) {
      setInSSRSetupState(false);
    }
    const restore = () => {
      setCurrentInstance(ctx);
      if (inSSRSetup) {
        setInSSRSetupState(true);
      }
    };
    const cleanup = () => {
      if (getCurrentInstance() !== ctx) ctx.scope.off();
      unsetCurrentInstance();
      if (inSSRSetup) {
        setInSSRSetupState(false);
      }
    };
    if (isPromise(awaitable)) {
      awaitable = awaitable.catch((e) => {
        restore();
        Promise.resolve().then(() => Promise.resolve().then(cleanup));
        throw e;
      });
    }
    return [
      awaitable,
      () => {
        restore();
        Promise.resolve().then(cleanup);
      }
    ];
  }
  let shouldCacheAccess = true;
  function applyOptions(instance) {
    const options = resolveMergedOptions(instance);
    const publicThis = instance.proxy;
    const ctx = instance.ctx;
    shouldCacheAccess = false;
    if (options.beforeCreate) {
      callHook$1(options.beforeCreate, instance, "bc");
    }
    const {
      // state
      data: dataOptions,
      computed: computedOptions,
      methods,
      watch: watchOptions,
      provide: provideOptions,
      inject: injectOptions,
      // lifecycle
      created,
      beforeMount,
      mounted,
      beforeUpdate,
      updated,
      activated,
      deactivated,
      beforeDestroy,
      beforeUnmount,
      destroyed,
      unmounted,
      render: render2,
      renderTracked,
      renderTriggered,
      errorCaptured,
      serverPrefetch,
      // public API
      expose,
      inheritAttrs,
      // assets
      components,
      directives,
      filters
    } = options;
    const checkDuplicateProperties = null;
    if (injectOptions) {
      resolveInjections(injectOptions, ctx, checkDuplicateProperties);
    }
    if (methods) {
      for (const key in methods) {
        const methodHandler = methods[key];
        if (isFunction(methodHandler)) {
          {
            ctx[key] = methodHandler.bind(publicThis);
          }
        }
      }
    }
    if (dataOptions) {
      const data = dataOptions.call(publicThis, publicThis);
      if (!isObject(data)) ;
      else {
        instance.data = /* @__PURE__ */ reactive$1(data);
      }
    }
    shouldCacheAccess = true;
    if (computedOptions) {
      for (const key in computedOptions) {
        const opt = computedOptions[key];
        const get = isFunction(opt) ? opt.bind(publicThis, publicThis) : isFunction(opt.get) ? opt.get.bind(publicThis, publicThis) : NOOP;
        const set = !isFunction(opt) && isFunction(opt.set) ? opt.set.bind(publicThis) : NOOP;
        const c = computed$h({
          get,
          set
        });
        Object.defineProperty(ctx, key, {
          enumerable: true,
          configurable: true,
          get: () => c.value,
          set: (v) => c.value = v
        });
      }
    }
    if (watchOptions) {
      for (const key in watchOptions) {
        createWatcher(watchOptions[key], ctx, publicThis, key);
      }
    }
    if (provideOptions) {
      const provides = isFunction(provideOptions) ? provideOptions.call(publicThis) : provideOptions;
      Reflect.ownKeys(provides).forEach((key) => {
        provide(key, provides[key]);
      });
    }
    if (created) {
      callHook$1(created, instance, "c");
    }
    function registerLifecycleHook(register, hook) {
      if (isArray(hook)) {
        hook.forEach((_hook) => register(_hook.bind(publicThis)));
      } else if (hook) {
        register(hook.bind(publicThis));
      }
    }
    registerLifecycleHook(onBeforeMount, beforeMount);
    registerLifecycleHook(onMounted$d, mounted);
    registerLifecycleHook(onBeforeUpdate, beforeUpdate);
    registerLifecycleHook(onUpdated, updated);
    registerLifecycleHook(onActivated, activated);
    registerLifecycleHook(onDeactivated, deactivated);
    registerLifecycleHook(onErrorCaptured, errorCaptured);
    registerLifecycleHook(onRenderTracked, renderTracked);
    registerLifecycleHook(onRenderTriggered, renderTriggered);
    registerLifecycleHook(onBeforeUnmount$2, beforeUnmount);
    registerLifecycleHook(onUnmounted$9, unmounted);
    registerLifecycleHook(onServerPrefetch, serverPrefetch);
    if (isArray(expose)) {
      if (expose.length) {
        const exposed = instance.exposed || (instance.exposed = {});
        expose.forEach((key) => {
          Object.defineProperty(exposed, key, {
            get: () => publicThis[key],
            set: (val) => publicThis[key] = val,
            enumerable: true
          });
        });
      } else if (!instance.exposed) {
        instance.exposed = {};
      }
    }
    if (render2 && instance.render === NOOP) {
      instance.render = render2;
    }
    if (inheritAttrs != null) {
      instance.inheritAttrs = inheritAttrs;
    }
    if (components) instance.components = components;
    if (directives) instance.directives = directives;
    if (serverPrefetch) {
      markAsyncBoundary(instance);
    }
  }
  function resolveInjections(injectOptions, ctx, checkDuplicateProperties = NOOP) {
    if (isArray(injectOptions)) {
      injectOptions = normalizeInject(injectOptions);
    }
    for (const key in injectOptions) {
      const opt = injectOptions[key];
      let injected;
      if (isObject(opt)) {
        if ("default" in opt) {
          injected = inject(
            opt.from || key,
            opt.default,
            true
          );
        } else {
          injected = inject(opt.from || key);
        }
      } else {
        injected = inject(opt);
      }
      if (/* @__PURE__ */ isRef(injected)) {
        Object.defineProperty(ctx, key, {
          enumerable: true,
          configurable: true,
          get: () => injected.value,
          set: (v) => injected.value = v
        });
      } else {
        ctx[key] = injected;
      }
    }
  }
  function callHook$1(hook, instance, type) {
    callWithAsyncErrorHandling(
      isArray(hook) ? hook.map((h2) => h2.bind(instance.proxy)) : hook.bind(instance.proxy),
      instance,
      type
    );
  }
  function createWatcher(raw, ctx, publicThis, key) {
    let getter = key.includes(".") ? createPathGetter(publicThis, key) : () => publicThis[key];
    if (isString(raw)) {
      const handler = ctx[raw];
      if (isFunction(handler)) {
        {
          watch$e(getter, handler);
        }
      }
    } else if (isFunction(raw)) {
      {
        watch$e(getter, raw.bind(publicThis));
      }
    } else if (isObject(raw)) {
      if (isArray(raw)) {
        raw.forEach((r) => createWatcher(r, ctx, publicThis, key));
      } else {
        const handler = isFunction(raw.handler) ? raw.handler.bind(publicThis) : ctx[raw.handler];
        if (isFunction(handler)) {
          watch$e(getter, handler, raw);
        }
      }
    } else ;
  }
  function resolveMergedOptions(instance) {
    const base = instance.type;
    const { mixins, extends: extendsOptions } = base;
    const {
      mixins: globalMixins,
      optionsCache: cache,
      config: { optionMergeStrategies }
    } = instance.appContext;
    const cached = cache.get(base);
    let resolved;
    if (cached) {
      resolved = cached;
    } else if (!globalMixins.length && !mixins && !extendsOptions) {
      {
        resolved = base;
      }
    } else {
      resolved = {};
      if (globalMixins.length) {
        globalMixins.forEach(
          (m) => mergeOptions(resolved, m, optionMergeStrategies, true)
        );
      }
      mergeOptions(resolved, base, optionMergeStrategies);
    }
    if (isObject(base)) {
      cache.set(base, resolved);
    }
    return resolved;
  }
  function mergeOptions(to, from, strats, asMixin = false) {
    const { mixins, extends: extendsOptions } = from;
    if (extendsOptions) {
      mergeOptions(to, extendsOptions, strats, true);
    }
    if (mixins) {
      mixins.forEach(
        (m) => mergeOptions(to, m, strats, true)
      );
    }
    for (const key in from) {
      if (asMixin && key === "expose") ;
      else {
        const strat = internalOptionMergeStrats[key] || strats && strats[key];
        to[key] = strat ? strat(to[key], from[key]) : from[key];
      }
    }
    return to;
  }
  const internalOptionMergeStrats = {
    data: mergeDataFn,
    props: mergeEmitsOrPropsOptions,
    emits: mergeEmitsOrPropsOptions,
    // objects
    methods: mergeObjectOptions,
    computed: mergeObjectOptions,
    // lifecycle
    beforeCreate: mergeAsArray,
    created: mergeAsArray,
    beforeMount: mergeAsArray,
    mounted: mergeAsArray,
    beforeUpdate: mergeAsArray,
    updated: mergeAsArray,
    beforeDestroy: mergeAsArray,
    beforeUnmount: mergeAsArray,
    destroyed: mergeAsArray,
    unmounted: mergeAsArray,
    activated: mergeAsArray,
    deactivated: mergeAsArray,
    errorCaptured: mergeAsArray,
    serverPrefetch: mergeAsArray,
    // assets
    components: mergeObjectOptions,
    directives: mergeObjectOptions,
    // watch
    watch: mergeWatchOptions,
    // provide / inject
    provide: mergeDataFn,
    inject: mergeInject
  };
  function mergeDataFn(to, from) {
    if (!from) {
      return to;
    }
    if (!to) {
      return from;
    }
    return function mergedDataFn() {
      return extend(
        isFunction(to) ? to.call(this, this) : to,
        isFunction(from) ? from.call(this, this) : from
      );
    };
  }
  function mergeInject(to, from) {
    return mergeObjectOptions(normalizeInject(to), normalizeInject(from));
  }
  function normalizeInject(raw) {
    if (isArray(raw)) {
      const res = {};
      for (let i = 0; i < raw.length; i++) {
        res[raw[i]] = raw[i];
      }
      return res;
    }
    return raw;
  }
  function mergeAsArray(to, from) {
    return to ? [...new Set([].concat(to, from))] : from;
  }
  function mergeObjectOptions(to, from) {
    return to ? extend(/* @__PURE__ */ Object.create(null), to, from) : from;
  }
  function mergeEmitsOrPropsOptions(to, from) {
    if (to) {
      if (isArray(to) && isArray(from)) {
        return [.../* @__PURE__ */ new Set([...to, ...from])];
      }
      return extend(
        /* @__PURE__ */ Object.create(null),
        normalizePropsOrEmits(to),
        normalizePropsOrEmits(from != null ? from : {})
      );
    } else {
      return from;
    }
  }
  function mergeWatchOptions(to, from) {
    if (!to) return from;
    if (!from) return to;
    const merged = extend(/* @__PURE__ */ Object.create(null), to);
    for (const key in from) {
      merged[key] = mergeAsArray(to[key], from[key]);
    }
    return merged;
  }
  function createAppContext() {
    return {
      app: null,
      config: {
        isNativeTag: NO,
        performance: false,
        globalProperties: {},
        optionMergeStrategies: {},
        errorHandler: void 0,
        warnHandler: void 0,
        compilerOptions: {}
      },
      mixins: [],
      components: {},
      directives: {},
      provides: /* @__PURE__ */ Object.create(null),
      optionsCache: /* @__PURE__ */ new WeakMap(),
      propsCache: /* @__PURE__ */ new WeakMap(),
      emitsCache: /* @__PURE__ */ new WeakMap()
    };
  }
  let uid$1 = 0;
  function createAppAPI(render2, hydrate2) {
    return function createApp2(rootComponent, rootProps = null) {
      if (!isFunction(rootComponent)) {
        rootComponent = extend({}, rootComponent);
      }
      if (rootProps != null && !isObject(rootProps)) {
        rootProps = null;
      }
      const context = createAppContext();
      const installedPlugins = /* @__PURE__ */ new WeakSet();
      const pluginCleanupFns = [];
      let isMounted = false;
      const app2 = context.app = {
        _uid: uid$1++,
        _component: rootComponent,
        _props: rootProps,
        _container: null,
        _context: context,
        _instance: null,
        version,
        get config() {
          return context.config;
        },
        set config(v) {
        },
        use(plugin, ...options) {
          if (installedPlugins.has(plugin)) ;
          else if (plugin && isFunction(plugin.install)) {
            installedPlugins.add(plugin);
            plugin.install(app2, ...options);
          } else if (isFunction(plugin)) {
            installedPlugins.add(plugin);
            plugin(app2, ...options);
          } else ;
          return app2;
        },
        mixin(mixin) {
          {
            if (!context.mixins.includes(mixin)) {
              context.mixins.push(mixin);
            }
          }
          return app2;
        },
        component(name, component) {
          if (!component) {
            return context.components[name];
          }
          context.components[name] = component;
          return app2;
        },
        directive(name, directive) {
          if (!directive) {
            return context.directives[name];
          }
          context.directives[name] = directive;
          return app2;
        },
        mount(rootContainer, isHydrate, namespace) {
          if (!isMounted) {
            const vnode = app2._ceVNode || createVNode(rootComponent, rootProps);
            vnode.appContext = context;
            if (namespace === true) {
              namespace = "svg";
            } else if (namespace === false) {
              namespace = void 0;
            }
            if (isHydrate && hydrate2) {
              hydrate2(vnode, rootContainer);
            } else {
              render2(vnode, rootContainer, namespace);
            }
            isMounted = true;
            app2._container = rootContainer;
            rootContainer.__vue_app__ = app2;
            return getComponentPublicInstance(vnode.component);
          }
        },
        onUnmount(cleanupFn) {
          pluginCleanupFns.push(cleanupFn);
        },
        unmount() {
          if (isMounted) {
            callWithAsyncErrorHandling(
              pluginCleanupFns,
              app2._instance,
              16
            );
            render2(null, app2._container);
            delete app2._container.__vue_app__;
          }
        },
        provide(key, value) {
          context.provides[key] = value;
          return app2;
        },
        runWithContext(fn) {
          const lastApp = currentApp;
          currentApp = app2;
          try {
            return fn();
          } finally {
            currentApp = lastApp;
          }
        }
      };
      return app2;
    };
  }
  let currentApp = null;
  function useModel(props, name, options = EMPTY_OBJ) {
    const i = getCurrentInstance();
    const camelizedName = camelize(name);
    const hyphenatedName = hyphenate(name);
    const modifiers = getModelModifiers(props, camelizedName);
    const res = customRef((track2, trigger2) => {
      let localValue;
      let prevSetValue = EMPTY_OBJ;
      let prevEmittedValue;
      watchSyncEffect(() => {
        const propValue = props[camelizedName];
        if (hasChanged(localValue, propValue)) {
          localValue = propValue;
          trigger2();
        }
      });
      return {
        get() {
          track2();
          return options.get ? options.get(localValue) : localValue;
        },
        set(value) {
          const emittedValue = options.set ? options.set(value) : value;
          if (!hasChanged(emittedValue, localValue) && !(prevSetValue !== EMPTY_OBJ && hasChanged(value, prevSetValue))) {
            return;
          }
          const rawProps = i.vnode.props;
          const hasVModel = !!(rawProps && // check if parent has passed v-model
          (name in rawProps || camelizedName in rawProps || hyphenatedName in rawProps) && (`onUpdate:${name}` in rawProps || `onUpdate:${camelizedName}` in rawProps || `onUpdate:${hyphenatedName}` in rawProps));
          if (!hasVModel) {
            localValue = value;
            trigger2();
          }
          i.emit(`update:${name}`, emittedValue);
          if (hasChanged(value, prevSetValue) && (hasChanged(value, emittedValue) && !hasChanged(emittedValue, prevEmittedValue) || // #13524: browsers differ in when they flush microtasks between
          // event listeners. If a v-model listener emits an intermediate value
          // and a following listener restores the model to its previous prop
          // value before parent updates are flushed, the parent render can be
          // deduped as having no prop change. Force a local update so DOM state
          // such as an input's value is synchronized back to the current model.
          hasVModel && prevSetValue !== EMPTY_OBJ && !hasChanged(emittedValue, localValue))) {
            trigger2();
          }
          prevSetValue = value;
          prevEmittedValue = emittedValue;
        }
      };
    });
    res[Symbol.iterator] = () => {
      let i2 = 0;
      return {
        next() {
          if (i2 < 2) {
            return { value: i2++ ? modifiers || EMPTY_OBJ : res, done: false };
          } else {
            return { done: true };
          }
        }
      };
    };
    return res;
  }
  const getModelModifiers = (props, modelName) => {
    return modelName === "modelValue" || modelName === "model-value" ? props.modelModifiers : props[`${modelName}Modifiers`] || props[`${camelize(modelName)}Modifiers`] || props[`${hyphenate(modelName)}Modifiers`];
  };
  function emit(instance, event, ...rawArgs) {
    if (instance.isUnmounted) return;
    const props = instance.vnode.props || EMPTY_OBJ;
    let args = rawArgs;
    const isModelListener2 = event.startsWith("update:");
    const modifiers = isModelListener2 && getModelModifiers(props, event.slice(7));
    if (modifiers) {
      if (modifiers.trim) {
        args = rawArgs.map((a) => isString(a) ? a.trim() : a);
      }
      if (modifiers.number) {
        args = args.map(looseToNumber);
      }
    }
    let handlerName;
    let handler = props[handlerName = toHandlerKey(event)] || // also try camelCase event handler (#2249)
    props[handlerName = toHandlerKey(camelize(event))];
    if (!handler && isModelListener2) {
      handler = props[handlerName = toHandlerKey(hyphenate(event))];
    }
    if (handler) {
      callWithAsyncErrorHandling(
        handler,
        instance,
        6,
        args
      );
    }
    const onceHandler = props[handlerName + `Once`];
    if (onceHandler) {
      if (!instance.emitted) {
        instance.emitted = {};
      } else if (instance.emitted[handlerName]) {
        return;
      }
      instance.emitted[handlerName] = true;
      callWithAsyncErrorHandling(
        onceHandler,
        instance,
        6,
        args
      );
    }
  }
  const mixinEmitsCache = /* @__PURE__ */ new WeakMap();
  function normalizeEmitsOptions(comp, appContext, asMixin = false) {
    const cache = asMixin ? mixinEmitsCache : appContext.emitsCache;
    const cached = cache.get(comp);
    if (cached !== void 0) {
      return cached;
    }
    const raw = comp.emits;
    let normalized = {};
    let hasExtends = false;
    if (!isFunction(comp)) {
      const extendEmits = (raw2) => {
        const normalizedFromExtend = normalizeEmitsOptions(raw2, appContext, true);
        if (normalizedFromExtend) {
          hasExtends = true;
          extend(normalized, normalizedFromExtend);
        }
      };
      if (!asMixin && appContext.mixins.length) {
        appContext.mixins.forEach(extendEmits);
      }
      if (comp.extends) {
        extendEmits(comp.extends);
      }
      if (comp.mixins) {
        comp.mixins.forEach(extendEmits);
      }
    }
    if (!raw && !hasExtends) {
      if (isObject(comp)) {
        cache.set(comp, null);
      }
      return null;
    }
    if (isArray(raw)) {
      raw.forEach((key) => normalized[key] = null);
    } else {
      extend(normalized, raw);
    }
    if (isObject(comp)) {
      cache.set(comp, normalized);
    }
    return normalized;
  }
  function isEmitListener(options, key) {
    if (!options || !isOn(key)) {
      return false;
    }
    key = key.slice(2);
    key = key === "Once" ? key : key.replace(/Once$/, "");
    return hasOwn(options, key[0].toLowerCase() + key.slice(1)) || hasOwn(options, hyphenate(key)) || hasOwn(options, key);
  }
  function markAttrsAccessed() {
  }
  function renderComponentRoot(instance) {
    const {
      type: Component,
      vnode,
      proxy,
      withProxy,
      propsOptions: [propsOptions],
      slots,
      attrs,
      emit: emit2,
      render: render2,
      renderCache,
      props,
      data,
      setupState,
      ctx,
      inheritAttrs
    } = instance;
    const prev = setCurrentRenderingInstance(instance);
    let result;
    let fallthroughAttrs;
    try {
      if (vnode.shapeFlag & 4) {
        const proxyToUse = withProxy || proxy;
        const thisProxy = false ? new Proxy(proxyToUse, {
          get(target, key, receiver) {
            warn$1(
              `Property '${String(
                key
              )}' was accessed via 'this'. Avoid using 'this' in templates.`
            );
            return Reflect.get(target, key, receiver);
          }
        }) : proxyToUse;
        result = normalizeVNode(
          render2.call(
            thisProxy,
            proxyToUse,
            renderCache,
            false ? /* @__PURE__ */ shallowReadonly(props) : props,
            setupState,
            data,
            ctx
          )
        );
        fallthroughAttrs = attrs;
      } else {
        const render22 = Component;
        if (false) ;
        result = normalizeVNode(
          render22.length > 1 ? render22(
            false ? /* @__PURE__ */ shallowReadonly(props) : props,
            false ? {
              get attrs() {
                markAttrsAccessed();
                return /* @__PURE__ */ shallowReadonly(attrs);
              },
              slots,
              emit: emit2
            } : { attrs, slots, emit: emit2 }
          ) : render22(
            false ? /* @__PURE__ */ shallowReadonly(props) : props,
            null
          )
        );
        fallthroughAttrs = Component.props ? attrs : getFunctionalFallthrough(attrs);
      }
    } catch (err) {
      blockStack.length = 0;
      handleError(err, instance, 1);
      result = createVNode(Comment);
    }
    let root = result;
    if (fallthroughAttrs && inheritAttrs !== false) {
      const keys = Object.keys(fallthroughAttrs);
      const { shapeFlag } = root;
      if (keys.length) {
        if (shapeFlag & (1 | 6)) {
          if (propsOptions && keys.some(isModelListener)) {
            fallthroughAttrs = filterModelListeners(
              fallthroughAttrs,
              propsOptions
            );
          }
          root = cloneVNode(root, fallthroughAttrs, false, true);
        }
      }
    }
    if (vnode.dirs) {
      root = cloneVNode(root, null, false, true);
      root.dirs = root.dirs ? root.dirs.concat(vnode.dirs) : vnode.dirs;
    }
    if (vnode.transition) {
      const child = isTeleport(root.type) ? getInnerChild$1(root) || root : root;
      setTransitionHooks(child, vnode.transition);
    }
    {
      result = root;
    }
    setCurrentRenderingInstance(prev);
    return result;
  }
  function filterSingleRoot(children, recurse = true) {
    let singleRoot;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (isVNode(child)) {
        if (child.type !== Comment || child.children === "v-if") {
          if (singleRoot) {
            return;
          } else {
            singleRoot = child;
          }
        }
      } else {
        return;
      }
    }
    return singleRoot;
  }
  const getFunctionalFallthrough = (attrs) => {
    let res;
    for (const key in attrs) {
      if (key === "class" || key === "style" || isOn(key)) {
        (res || (res = {}))[key] = attrs[key];
      }
    }
    return res;
  };
  const filterModelListeners = (attrs, props) => {
    const res = {};
    for (const key in attrs) {
      if (!isModelListener(key) || !(key.slice(9) in props)) {
        res[key] = attrs[key];
      }
    }
    return res;
  };
  function shouldUpdateComponent(prevVNode, nextVNode, optimized) {
    const { props: prevProps, children: prevChildren, component } = prevVNode;
    const { props: nextProps, children: nextChildren, patchFlag } = nextVNode;
    const emits = component.emitsOptions;
    if (nextVNode.dirs || nextVNode.transition) {
      return true;
    }
    if (optimized && patchFlag >= 0) {
      if (patchFlag & 1024) {
        return true;
      }
      if (patchFlag & 16) {
        if (!prevProps) {
          return !!nextProps;
        }
        return hasPropsChanged(prevProps, nextProps, emits);
      } else if (patchFlag & 8) {
        const dynamicProps = nextVNode.dynamicProps;
        for (let i = 0; i < dynamicProps.length; i++) {
          const key = dynamicProps[i];
          if (hasPropValueChanged(nextProps, prevProps, key) && !isEmitListener(emits, key)) {
            return true;
          }
        }
      }
    } else {
      if (prevChildren || nextChildren) {
        if (!nextChildren || !nextChildren.$stable) {
          return true;
        }
      }
      if (prevProps === nextProps) {
        return false;
      }
      if (!prevProps) {
        return !!nextProps;
      }
      if (!nextProps) {
        return true;
      }
      return hasPropsChanged(prevProps, nextProps, emits);
    }
    return false;
  }
  function hasPropsChanged(prevProps, nextProps, emitsOptions) {
    const nextKeys = Object.keys(nextProps);
    if (nextKeys.length !== Object.keys(prevProps).length) {
      return true;
    }
    for (let i = 0; i < nextKeys.length; i++) {
      const key = nextKeys[i];
      if (!hasOwn(prevProps, key) || hasPropValueChanged(nextProps, prevProps, key) && !isEmitListener(emitsOptions, key)) {
        return true;
      }
    }
    return false;
  }
  function hasPropValueChanged(nextProps, prevProps, key) {
    const nextProp = nextProps[key];
    const prevProp = prevProps[key];
    if (key === "style" && isObject(nextProp) && isObject(prevProp)) {
      return !looseEqual(nextProp, prevProp);
    }
    return nextProp !== prevProp;
  }
  function updateHOCHostEl({ vnode, parent, suspense }, el) {
    while (parent) {
      const root = parent.subTree;
      if (root.suspense && root.suspense.activeBranch === vnode) {
        root.suspense.vnode.el = root.el = el;
        vnode = root;
      }
      if (root === vnode) {
        (vnode = parent.vnode).el = el;
        parent = parent.parent;
      } else {
        break;
      }
    }
    if (suspense && suspense.activeBranch === vnode) {
      suspense.vnode.el = el;
    }
  }
  const internalObjectProto = {};
  const createInternalObject = () => Object.create(internalObjectProto);
  const isInternalObject = (obj) => Object.getPrototypeOf(obj) === internalObjectProto;
  function initProps(instance, rawProps, isStateful, isSSR = false) {
    const props = {};
    const attrs = createInternalObject();
    instance.propsDefaults = /* @__PURE__ */ Object.create(null);
    setFullProps(instance, rawProps, props, attrs);
    for (const key in instance.propsOptions[0]) {
      if (!(key in props)) {
        props[key] = void 0;
      }
    }
    if (isStateful) {
      instance.props = isSSR ? props : /* @__PURE__ */ shallowReactive(props);
    } else {
      if (!instance.type.props) {
        instance.props = attrs;
      } else {
        instance.props = props;
      }
    }
    instance.attrs = attrs;
  }
  function updateProps(instance, rawProps, rawPrevProps, optimized) {
    const {
      props,
      attrs,
      vnode: { patchFlag }
    } = instance;
    const rawCurrentProps = /* @__PURE__ */ toRaw(props);
    const [options] = instance.propsOptions;
    let hasAttrsChanged = false;
    if (
      // always force full diff in dev
      // - #1942 if hmr is enabled with sfc component
      // - vite#872 non-sfc component used by sfc component
      (optimized || patchFlag > 0) && !(patchFlag & 16)
    ) {
      if (patchFlag & 8) {
        const propsToUpdate = instance.vnode.dynamicProps;
        for (let i = 0; i < propsToUpdate.length; i++) {
          let key = propsToUpdate[i];
          if (isEmitListener(instance.emitsOptions, key)) {
            continue;
          }
          const value = rawProps[key];
          if (options) {
            if (hasOwn(attrs, key)) {
              if (value !== attrs[key]) {
                attrs[key] = value;
                hasAttrsChanged = true;
              }
            } else {
              const camelizedKey = camelize(key);
              props[camelizedKey] = resolvePropValue(
                options,
                rawCurrentProps,
                camelizedKey,
                value,
                instance,
                false
              );
            }
          } else {
            if (value !== attrs[key]) {
              attrs[key] = value;
              hasAttrsChanged = true;
            }
          }
        }
      }
    } else {
      if (setFullProps(instance, rawProps, props, attrs)) {
        hasAttrsChanged = true;
      }
      let kebabKey;
      for (const key in rawCurrentProps) {
        if (!rawProps || // for camelCase
        !hasOwn(rawProps, key) && // it's possible the original props was passed in as kebab-case
        // and converted to camelCase (#955)
        ((kebabKey = hyphenate(key)) === key || !hasOwn(rawProps, kebabKey))) {
          if (options) {
            if (rawPrevProps && // for camelCase
            (rawPrevProps[key] !== void 0 || // for kebab-case
            rawPrevProps[kebabKey] !== void 0)) {
              props[key] = resolvePropValue(
                options,
                rawCurrentProps,
                key,
                void 0,
                instance,
                true
              );
            }
          } else {
            delete props[key];
          }
        }
      }
      if (attrs !== rawCurrentProps) {
        for (const key in attrs) {
          if (!rawProps || !hasOwn(rawProps, key) && true) {
            delete attrs[key];
            hasAttrsChanged = true;
          }
        }
      }
    }
    if (hasAttrsChanged) {
      trigger(instance.attrs, "set", "");
    }
  }
  function setFullProps(instance, rawProps, props, attrs) {
    const [options, needCastKeys] = instance.propsOptions;
    let hasAttrsChanged = false;
    let rawCastValues;
    if (rawProps) {
      for (let key in rawProps) {
        if (isReservedProp(key)) {
          continue;
        }
        const value = rawProps[key];
        let camelKey;
        if (options && hasOwn(options, camelKey = camelize(key))) {
          if (!needCastKeys || !needCastKeys.includes(camelKey)) {
            props[camelKey] = value;
          } else {
            (rawCastValues || (rawCastValues = {}))[camelKey] = value;
          }
        } else if (!isEmitListener(instance.emitsOptions, key)) {
          if (!(key in attrs) || value !== attrs[key]) {
            attrs[key] = value;
            hasAttrsChanged = true;
          }
        }
      }
    }
    if (needCastKeys) {
      const rawCurrentProps = /* @__PURE__ */ toRaw(props);
      const castValues = rawCastValues || EMPTY_OBJ;
      for (let i = 0; i < needCastKeys.length; i++) {
        const key = needCastKeys[i];
        props[key] = resolvePropValue(
          options,
          rawCurrentProps,
          key,
          castValues[key],
          instance,
          !hasOwn(castValues, key)
        );
      }
    }
    return hasAttrsChanged;
  }
  function resolvePropValue(options, props, key, value, instance, isAbsent) {
    const opt = options[key];
    if (opt != null) {
      const hasDefault = hasOwn(opt, "default");
      if (hasDefault && value === void 0) {
        const defaultValue = opt.default;
        if (opt.type !== Function && !opt.skipFactory && isFunction(defaultValue)) {
          const { propsDefaults } = instance;
          if (key in propsDefaults) {
            value = propsDefaults[key];
          } else {
            const reset = setCurrentInstance(instance);
            value = propsDefaults[key] = defaultValue.call(
              null,
              props
            );
            reset();
          }
        } else {
          value = defaultValue;
        }
        if (instance.ce) {
          instance.ce._setProp(key, value);
        }
      }
      if (opt[
        0
        /* shouldCast */
      ]) {
        if (isAbsent && !hasDefault) {
          value = false;
        } else if (opt[
          1
          /* shouldCastTrue */
        ] && (value === "" || value === hyphenate(key))) {
          value = true;
        }
      }
    }
    return value;
  }
  const mixinPropsCache = /* @__PURE__ */ new WeakMap();
  function normalizePropsOptions(comp, appContext, asMixin = false) {
    const cache = asMixin ? mixinPropsCache : appContext.propsCache;
    const cached = cache.get(comp);
    if (cached) {
      return cached;
    }
    const raw = comp.props;
    const normalized = {};
    const needCastKeys = [];
    let hasExtends = false;
    if (!isFunction(comp)) {
      const extendProps = (raw2) => {
        hasExtends = true;
        const [props, keys] = normalizePropsOptions(raw2, appContext, true);
        extend(normalized, props);
        if (keys) needCastKeys.push(...keys);
      };
      if (!asMixin && appContext.mixins.length) {
        appContext.mixins.forEach(extendProps);
      }
      if (comp.extends) {
        extendProps(comp.extends);
      }
      if (comp.mixins) {
        comp.mixins.forEach(extendProps);
      }
    }
    if (!raw && !hasExtends) {
      if (isObject(comp)) {
        cache.set(comp, EMPTY_ARR);
      }
      return EMPTY_ARR;
    }
    if (isArray(raw)) {
      for (let i = 0; i < raw.length; i++) {
        const normalizedKey = camelize(raw[i]);
        if (validatePropName(normalizedKey)) {
          normalized[normalizedKey] = EMPTY_OBJ;
        }
      }
    } else if (raw) {
      for (const key in raw) {
        const normalizedKey = camelize(key);
        if (validatePropName(normalizedKey)) {
          const opt = raw[key];
          const prop = normalized[normalizedKey] = isArray(opt) || isFunction(opt) ? { type: opt } : extend({}, opt);
          const propType = prop.type;
          let shouldCast = false;
          let shouldCastTrue = true;
          if (isArray(propType)) {
            for (let index = 0; index < propType.length; ++index) {
              const type = propType[index];
              const typeName = isFunction(type) && type.name;
              if (typeName === "Boolean") {
                shouldCast = true;
                break;
              } else if (typeName === "String") {
                shouldCastTrue = false;
              }
            }
          } else {
            shouldCast = isFunction(propType) && propType.name === "Boolean";
          }
          prop[
            0
            /* shouldCast */
          ] = shouldCast;
          prop[
            1
            /* shouldCastTrue */
          ] = shouldCastTrue;
          if (shouldCast || hasOwn(prop, "default")) {
            needCastKeys.push(normalizedKey);
          }
        }
      }
    }
    const res = [normalized, needCastKeys];
    if (isObject(comp)) {
      cache.set(comp, res);
    }
    return res;
  }
  function validatePropName(key) {
    if (key[0] !== "$" && !isReservedProp(key)) {
      return true;
    }
    return false;
  }
  const isInternalKey = (key) => key === "_" || key === "_ctx" || key === "$stable";
  const normalizeSlotValue = (value) => isArray(value) ? value.map(normalizeVNode) : [normalizeVNode(value)];
  const normalizeSlot = (key, rawSlot, ctx) => {
    if (rawSlot._n) {
      return rawSlot;
    }
    const normalized = withCtx((...args) => {
      if (false) ;
      return normalizeSlotValue(rawSlot(...args));
    }, ctx);
    normalized._c = false;
    return normalized;
  };
  const normalizeObjectSlots = (rawSlots, slots, instance) => {
    const ctx = rawSlots._ctx;
    for (const key in rawSlots) {
      if (isInternalKey(key)) continue;
      const value = rawSlots[key];
      if (isFunction(value)) {
        slots[key] = normalizeSlot(key, value, ctx);
      } else if (value != null) {
        const normalized = normalizeSlotValue(value);
        slots[key] = () => normalized;
      }
    }
  };
  const normalizeVNodeSlots = (instance, children) => {
    const normalized = normalizeSlotValue(children);
    instance.slots.default = () => normalized;
  };
  const assignSlots = (slots, children, optimized) => {
    for (const key in children) {
      if (optimized || !isInternalKey(key)) {
        slots[key] = children[key];
      }
    }
  };
  const initSlots = (instance, children, optimized) => {
    const slots = instance.slots = createInternalObject();
    if (instance.vnode.shapeFlag & 32) {
      const type = children._;
      if (type) {
        assignSlots(slots, children, optimized);
        if (optimized) {
          def(slots, "_", type, true);
        }
      } else {
        normalizeObjectSlots(children, slots);
      }
    } else if (children) {
      normalizeVNodeSlots(instance, children);
    }
  };
  const updateSlots = (instance, children, optimized) => {
    const { vnode, slots } = instance;
    let needDeletionCheck = true;
    let deletionComparisonTarget = EMPTY_OBJ;
    if (vnode.shapeFlag & 32) {
      const type = children._;
      if (type) {
        if (optimized && type === 1) {
          needDeletionCheck = false;
        } else {
          assignSlots(slots, children, optimized);
        }
      } else {
        needDeletionCheck = !children.$stable;
        normalizeObjectSlots(children, slots);
      }
      deletionComparisonTarget = children;
    } else if (children) {
      normalizeVNodeSlots(instance, children);
      deletionComparisonTarget = { default: 1 };
    }
    if (needDeletionCheck) {
      for (const key in slots) {
        if (!isInternalKey(key) && deletionComparisonTarget[key] == null) {
          delete slots[key];
        }
      }
    }
  };
  const queuePostRenderEffect = queueEffectWithSuspense;
  function createRenderer(options) {
    return baseCreateRenderer(options);
  }
  function createHydrationRenderer(options) {
    return baseCreateRenderer(options, createHydrationFunctions);
  }
  function baseCreateRenderer(options, createHydrationFns) {
    const target = getGlobalThis();
    target.__VUE__ = true;
    const {
      insert: hostInsert,
      remove: hostRemove,
      patchProp: hostPatchProp,
      createElement: hostCreateElement,
      createText: hostCreateText,
      createComment: hostCreateComment,
      setText: hostSetText,
      setElementText: hostSetElementText,
      parentNode: hostParentNode,
      nextSibling: hostNextSibling,
      setScopeId: hostSetScopeId = NOOP,
      insertStaticContent: hostInsertStaticContent
    } = options;
    const patch = (n1, n2, container, anchor = null, parentComponent = null, parentSuspense = null, namespace = void 0, slotScopeIds = null, optimized = !!n2.dynamicChildren) => {
      if (n1 === n2) {
        return;
      }
      if (n1 && !isSameVNodeType(n1, n2)) {
        anchor = getNextHostNode(n1);
        unmount(n1, parentComponent, parentSuspense, true);
        n1 = null;
      }
      if (n2.patchFlag === -2) {
        optimized = false;
        n2.dynamicChildren = null;
      }
      if (n2.dynamicChildren && n1 && n1.dynamicChildren && n1.dynamicChildren.hasOnce) {
        if (n2.dynamicChildren === EMPTY_ARR) {
          n2.dynamicChildren = [];
        }
        n2.dynamicChildren.hasOnce = true;
      }
      const { type, ref: ref3, shapeFlag } = n2;
      switch (type) {
        case Text:
          processText(n1, n2, container, anchor);
          break;
        case Comment:
          processCommentNode(n1, n2, container, anchor);
          break;
        case Static:
          if (n1 == null) {
            mountStaticNode(n2, container, anchor, namespace);
          }
          break;
        case Fragment:
          processFragment(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
          break;
        default:
          if (shapeFlag & 1) {
            processElement(
              n1,
              n2,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
          } else if (shapeFlag & 6) {
            processComponent(
              n1,
              n2,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
          } else if (shapeFlag & 64) {
            type.process(
              n1,
              n2,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized,
              internals
            );
          } else if (shapeFlag & 128) {
            type.process(
              n1,
              n2,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized,
              internals
            );
          } else ;
      }
      if (ref3 != null && parentComponent) {
        setRef(ref3, n1 && n1.ref, parentSuspense, n2 || n1, !n2);
      } else if (ref3 == null && n1 && n1.ref != null) {
        setRef(n1.ref, null, parentSuspense, n1, true);
      }
    };
    const processText = (n1, n2, container, anchor) => {
      if (n1 == null) {
        hostInsert(
          n2.el = hostCreateText(n2.children),
          container,
          anchor
        );
      } else {
        const el = n2.el = n1.el;
        if (n2.children !== n1.children) {
          hostSetText(el, n2.children);
        }
      }
    };
    const processCommentNode = (n1, n2, container, anchor) => {
      if (n1 == null) {
        hostInsert(
          n2.el = hostCreateComment(n2.children || ""),
          container,
          anchor
        );
      } else {
        n2.el = n1.el;
      }
    };
    const mountStaticNode = (n2, container, anchor, namespace) => {
      [n2.el, n2.anchor] = hostInsertStaticContent(
        n2.children,
        container,
        anchor,
        namespace,
        n2.el,
        n2.anchor
      );
    };
    const moveStaticNode = ({ el, anchor }, container, nextSibling) => {
      let next;
      while (el && el !== anchor) {
        next = hostNextSibling(el);
        hostInsert(el, container, nextSibling);
        el = next;
      }
      hostInsert(anchor, container, nextSibling);
    };
    const removeStaticNode = ({ el, anchor }) => {
      let next;
      while (el && el !== anchor) {
        next = hostNextSibling(el);
        hostRemove(el);
        el = next;
      }
      hostRemove(anchor);
    };
    const processElement = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      if (n2.type === "svg") {
        namespace = "svg";
      } else if (n2.type === "math") {
        namespace = "mathml";
      }
      if (n1 == null) {
        mountElement(
          n2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
      } else {
        const customElement = n1.el && n1.el._isVueCE ? n1.el : null;
        try {
          if (customElement) {
            customElement._beginPatch();
          }
          patchElement(
            n1,
            n2,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        } finally {
          if (customElement) {
            customElement._endPatch();
          }
        }
      }
    };
    const mountElement = (vnode, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      let el;
      let vnodeHook;
      const { props, shapeFlag, transition, dirs } = vnode;
      el = vnode.el = hostCreateElement(
        vnode.type,
        namespace,
        props && props.is,
        props
      );
      if (shapeFlag & 8) {
        hostSetElementText(el, vnode.children);
      } else if (shapeFlag & 16) {
        mountChildren(
          vnode.children,
          el,
          null,
          parentComponent,
          parentSuspense,
          resolveChildrenNamespace(vnode, namespace),
          slotScopeIds,
          optimized
        );
      }
      if (dirs) {
        invokeDirectiveHook(vnode, null, parentComponent, "created");
      }
      setScopeId(el, vnode, vnode.scopeId, slotScopeIds, parentComponent);
      if (props) {
        for (const key in props) {
          if (key !== "value" && !isReservedProp(key)) {
            hostPatchProp(el, key, null, props[key], namespace, parentComponent);
          }
        }
        if ("value" in props) {
          hostPatchProp(el, "value", null, props.value, namespace);
        }
        if (vnodeHook = props.onVnodeBeforeMount) {
          invokeVNodeHook(vnodeHook, parentComponent, vnode);
        }
      }
      if (dirs) {
        invokeDirectiveHook(vnode, null, parentComponent, "beforeMount");
      }
      const needCallTransitionHooks = needTransition(parentSuspense, transition);
      if (needCallTransitionHooks) {
        transition.beforeEnter(el);
      } else if (transition && !transition.persisted) {
        el[deferredEnterKey] = true;
      }
      hostInsert(el, container, anchor);
      if ((vnodeHook = props && props.onVnodeMounted) || needCallTransitionHooks || dirs) {
        queuePostRenderEffect(() => {
          try {
            vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
            needCallTransitionHooks && transition.enter(el);
            dirs && invokeDirectiveHook(vnode, null, parentComponent, "mounted");
          } finally {
          }
        }, parentSuspense);
      }
    };
    const setScopeId = (el, vnode, scopeId, slotScopeIds, parentComponent) => {
      if (scopeId) {
        hostSetScopeId(el, scopeId);
      }
      if (slotScopeIds) {
        for (let i = 0; i < slotScopeIds.length; i++) {
          hostSetScopeId(el, slotScopeIds[i]);
        }
      }
      if (parentComponent) {
        let subTree = parentComponent.subTree;
        if (vnode === subTree || isSuspense(subTree.type) && (subTree.ssContent === vnode || subTree.ssFallback === vnode)) {
          const parentVNode = parentComponent.vnode;
          setScopeId(
            el,
            parentVNode,
            parentVNode.scopeId,
            parentVNode.slotScopeIds,
            parentComponent.parent
          );
        }
      }
    };
    const mountChildren = (children, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, start = 0) => {
      for (let i = start; i < children.length; i++) {
        const child = children[i] = optimized ? cloneIfMounted(children[i]) : normalizeVNode(children[i]);
        patch(
          null,
          child,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
      }
    };
    const patchElement = (n1, n2, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      const el = n2.el = n1.el;
      let { patchFlag, dynamicChildren, dirs } = n2;
      patchFlag |= n1.patchFlag & 16;
      const oldProps = n1.props || EMPTY_OBJ;
      const newProps = n2.props || EMPTY_OBJ;
      let vnodeHook;
      parentComponent && toggleRecurse(parentComponent, false);
      if (vnodeHook = newProps.onVnodeBeforeUpdate) {
        invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
      }
      if (dirs) {
        invokeDirectiveHook(n2, n1, parentComponent, "beforeUpdate");
      }
      parentComponent && toggleRecurse(parentComponent, true);
      if (
        // #6385 the old vnode may be a user-wrapped non-isomorphic block
        // Force full diff when block metadata is unstable.
        dynamicChildren && (!n1.dynamicChildren || n1.dynamicChildren.length !== dynamicChildren.length)
      ) {
        patchFlag = 0;
        optimized = false;
        dynamicChildren = null;
      }
      if (oldProps.innerHTML && newProps.innerHTML == null || oldProps.textContent && newProps.textContent == null) {
        hostSetElementText(el, "");
      }
      if (dynamicChildren) {
        patchBlockChildren(
          n1.dynamicChildren,
          dynamicChildren,
          el,
          parentComponent,
          parentSuspense,
          resolveChildrenNamespace(n2, namespace),
          slotScopeIds
        );
      } else if (!optimized) {
        patchChildren(
          n1,
          n2,
          el,
          null,
          parentComponent,
          parentSuspense,
          resolveChildrenNamespace(n2, namespace),
          slotScopeIds,
          false
        );
      }
      if (patchFlag > 0) {
        if (patchFlag & 16) {
          patchProps(el, oldProps, newProps, parentComponent, namespace);
        } else {
          if (patchFlag & 2) {
            if (oldProps.class !== newProps.class) {
              hostPatchProp(el, "class", null, newProps.class, namespace);
            }
          }
          if (patchFlag & 4) {
            hostPatchProp(el, "style", oldProps.style, newProps.style, namespace);
          }
          if (patchFlag & 8) {
            const propsToUpdate = n2.dynamicProps;
            for (let i = 0; i < propsToUpdate.length; i++) {
              const key = propsToUpdate[i];
              const prev = oldProps[key];
              const next = newProps[key];
              if (next !== prev || key === "value") {
                hostPatchProp(el, key, prev, next, namespace, parentComponent);
              }
            }
          }
        }
        if (patchFlag & 1) {
          if (n1.children !== n2.children) {
            hostSetElementText(el, n2.children);
          }
        }
      } else if (!optimized && dynamicChildren == null) {
        patchProps(el, oldProps, newProps, parentComponent, namespace);
      }
      if ((vnodeHook = newProps.onVnodeUpdated) || dirs) {
        queuePostRenderEffect(() => {
          vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
          dirs && invokeDirectiveHook(n2, n1, parentComponent, "updated");
        }, parentSuspense);
      }
    };
    const patchBlockChildren = (oldChildren, newChildren, fallbackContainer, parentComponent, parentSuspense, namespace, slotScopeIds) => {
      for (let i = 0; i < newChildren.length; i++) {
        const oldVNode = oldChildren[i];
        const newVNode = newChildren[i];
        const oldEl = oldVNode.el || resolveAsyncComponentPlaceholder(oldVNode);
        const container = (
          // oldVNode may be an errored async setup() component inside Suspense
          // which will not have a mounted element
          oldEl && // - In the case of a Fragment, we need to provide the actual parent
          // of the Fragment itself so it can move its children.
          (oldVNode.type === Fragment || // - In the case of different nodes, there is going to be a replacement
          // which also requires the correct parent container
          !isSameVNodeType(oldVNode, newVNode) || // - In the case of a component, it could contain anything.
          oldVNode.shapeFlag & (6 | 64 | 128)) ? hostParentNode(oldEl) : (
            // In other cases, the parent container is not actually used so we
            // just pass the block element here to avoid a DOM parentNode call.
            fallbackContainer
          )
        );
        patch(
          oldVNode,
          newVNode,
          container,
          null,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          true
        );
      }
    };
    const patchProps = (el, oldProps, newProps, parentComponent, namespace) => {
      if (oldProps !== newProps) {
        if (oldProps !== EMPTY_OBJ) {
          for (const key in oldProps) {
            if (!isReservedProp(key) && !(key in newProps)) {
              hostPatchProp(
                el,
                key,
                oldProps[key],
                null,
                namespace,
                parentComponent
              );
            }
          }
        }
        for (const key in newProps) {
          if (isReservedProp(key)) continue;
          const next = newProps[key];
          const prev = oldProps[key];
          if (next !== prev && key !== "value") {
            hostPatchProp(el, key, prev, next, namespace, parentComponent);
          }
        }
        if ("value" in newProps) {
          hostPatchProp(el, "value", oldProps.value, newProps.value, namespace);
        }
      }
    };
    const processFragment = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      const fragmentStartAnchor = n2.el = n1 ? n1.el : hostCreateText("");
      const fragmentEndAnchor = n2.anchor = n1 ? n1.anchor : hostCreateText("");
      let { patchFlag, dynamicChildren, slotScopeIds: fragmentSlotScopeIds } = n2;
      if (fragmentSlotScopeIds) {
        slotScopeIds = slotScopeIds ? slotScopeIds.concat(fragmentSlotScopeIds) : fragmentSlotScopeIds;
      }
      if (n1 == null) {
        hostInsert(fragmentStartAnchor, container, anchor);
        hostInsert(fragmentEndAnchor, container, anchor);
        mountChildren(
          // #10007
          // such fragment like `<></>` will be compiled into
          // a fragment which doesn't have a children.
          // In this case fallback to an empty array
          n2.children || [],
          container,
          fragmentEndAnchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
      } else {
        if (patchFlag > 0 && patchFlag & 64 && dynamicChildren && // #2715 the previous fragment could've been a BAILed one as a result
        // of renderSlot() with no valid children
        n1.dynamicChildren && n1.dynamicChildren.length === dynamicChildren.length) {
          patchBlockChildren(
            n1.dynamicChildren,
            dynamicChildren,
            container,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds
          );
          if (
            // #2080 if the stable fragment has a key, it's a <template v-for> that may
            //  get moved around. Make sure all root level vnodes inherit el.
            // #2134 or if it's a component root, it may also get moved around
            // as the component is being moved.
            n2.key != null || parentComponent && n2 === parentComponent.subTree
          ) {
            traverseStaticChildren(
              n1,
              n2,
              true
              /* shallow */
            );
          }
        } else {
          patchChildren(
            n1,
            n2,
            container,
            fragmentEndAnchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        }
      }
    };
    const processComponent = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      n2.slotScopeIds = slotScopeIds;
      if (n1 == null) {
        if (n2.shapeFlag & 512) {
          parentComponent.ctx.activate(
            n2,
            container,
            anchor,
            namespace,
            optimized
          );
        } else {
          mountComponent(
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            optimized
          );
        }
      } else {
        updateComponent(n1, n2, optimized);
      }
    };
    const mountComponent = (initialVNode, container, anchor, parentComponent, parentSuspense, namespace, optimized) => {
      const instance = initialVNode.component = createComponentInstance(
        initialVNode,
        parentComponent,
        parentSuspense
      );
      if (isKeepAlive(initialVNode)) {
        instance.ctx.renderer = internals;
      }
      {
        setupComponent(instance, false, optimized);
      }
      if (instance.asyncDep) {
        parentSuspense && parentSuspense.registerDep(
          instance,
          setupRenderEffect,
          optimized,
          namespace
        );
        if (!initialVNode.el) {
          const placeholder = instance.subTree = createVNode(Comment);
          processCommentNode(null, placeholder, container, anchor);
          initialVNode.placeholder = placeholder.el;
        }
      } else {
        setupRenderEffect(
          instance,
          initialVNode,
          container,
          anchor,
          parentSuspense,
          namespace,
          optimized
        );
      }
    };
    const updateComponent = (n1, n2, optimized) => {
      const instance = n2.component = n1.component;
      if (shouldUpdateComponent(n1, n2, optimized)) {
        if (instance.asyncDep && !instance.asyncResolved) {
          n2.el = n1.el;
          n2.placeholder = n1.placeholder;
          updateComponentPreRender(instance, n2, optimized);
          return;
        } else {
          instance.next = n2;
          instance.update();
        }
      } else {
        n2.el = n1.el;
        n2.placeholder = n1.placeholder;
        instance.vnode = n2;
      }
    };
    const setupRenderEffect = (instance, initialVNode, container, anchor, parentSuspense, namespace, optimized) => {
      const componentUpdateFn = () => {
        if (!instance.isMounted) {
          let vnodeHook;
          const { el, props } = initialVNode;
          const { bm, m, parent, root, type } = instance;
          const isAsyncWrapperVNode = isAsyncWrapper(initialVNode);
          toggleRecurse(instance, false);
          if (bm) {
            invokeArrayFns(bm);
          }
          if (!isAsyncWrapperVNode && (vnodeHook = props && props.onVnodeBeforeMount)) {
            invokeVNodeHook(vnodeHook, parent, initialVNode);
          }
          toggleRecurse(instance, true);
          if (el && hydrateNode) {
            const hydrateSubTree = () => {
              instance.subTree = renderComponentRoot(instance);
              hydrateNode(
                el,
                instance.subTree,
                instance,
                parentSuspense,
                null
              );
            };
            if (isAsyncWrapperVNode && type.__asyncHydrate) {
              type.__asyncHydrate(
                el,
                instance,
                hydrateSubTree
              );
            } else {
              hydrateSubTree();
            }
          } else {
            if (root.ce && root.ce._hasShadowRoot()) {
              root.ce._injectChildStyle(
                type,
                instance.parent ? instance.parent.type : void 0
              );
            }
            const subTree = instance.subTree = renderComponentRoot(instance);
            patch(
              null,
              subTree,
              container,
              anchor,
              instance,
              parentSuspense,
              namespace
            );
            initialVNode.el = subTree.el;
          }
          if (m) {
            queuePostRenderEffect(m, parentSuspense);
          }
          if (!isAsyncWrapperVNode && (vnodeHook = props && props.onVnodeMounted)) {
            const scopedInitialVNode = initialVNode;
            queuePostRenderEffect(
              () => invokeVNodeHook(vnodeHook, parent, scopedInitialVNode),
              parentSuspense
            );
          }
          if (initialVNode.shapeFlag & 256 || parent && isAsyncWrapper(parent.vnode) && parent.vnode.shapeFlag & 256) {
            instance.a && queuePostRenderEffect(instance.a, parentSuspense);
          }
          instance.isMounted = true;
          initialVNode = container = anchor = null;
        } else {
          let { next, bu, u, parent, vnode } = instance;
          {
            const unresolvedAsyncRoot = locateUnresolvedAsyncRoot(instance);
            if (unresolvedAsyncRoot) {
              if (next) {
                next.el = vnode.el;
                updateComponentPreRender(instance, next, optimized);
              }
              unresolvedAsyncRoot.asyncDep.then(() => {
                const retry = () => {
                  if (instance.job.flags & 8) return;
                  if (parentSuspense && parentSuspense.pendingBranch) {
                    queuePostRenderEffect(retry, parentSuspense);
                  } else {
                    update();
                  }
                };
                retry.flags = 16 | 32;
                queuePostRenderEffect(retry, parentSuspense);
              });
              return;
            }
          }
          let originNext = next;
          let vnodeHook;
          toggleRecurse(instance, false);
          if (next) {
            next.el = vnode.el;
            updateComponentPreRender(instance, next, optimized);
          } else {
            next = vnode;
          }
          if (bu) {
            invokeArrayFns(bu);
          }
          if (vnodeHook = next.props && next.props.onVnodeBeforeUpdate) {
            invokeVNodeHook(vnodeHook, parent, next, vnode);
          }
          toggleRecurse(instance, true);
          const nextTree = renderComponentRoot(instance);
          const prevTree = instance.subTree;
          instance.subTree = nextTree;
          patch(
            prevTree,
            nextTree,
            // parent may have changed if it's in a teleport. a root that is a
            // pending async component only has its placeholder comment
            hostParentNode(
              prevTree.el || resolveAsyncComponentPlaceholder(prevTree)
            ),
            // anchor may have changed if it's in a fragment
            getNextHostNode(prevTree),
            instance,
            parentSuspense,
            namespace
          );
          next.el = nextTree.el;
          if (originNext === null) {
            updateHOCHostEl(instance, nextTree.el);
          }
          if (u) {
            queuePostRenderEffect(u, parentSuspense);
          }
          if (vnodeHook = next.props && next.props.onVnodeUpdated) {
            queuePostRenderEffect(
              () => invokeVNodeHook(vnodeHook, parent, next, vnode),
              parentSuspense
            );
          }
        }
      };
      instance.scope.on();
      const effect2 = instance.effect = new ReactiveEffect(componentUpdateFn);
      instance.scope.off();
      const update = instance.update = effect2.run.bind(effect2);
      const job = instance.job = effect2.runIfDirty.bind(effect2);
      job.i = instance;
      job.id = instance.uid;
      effect2.scheduler = () => queueJob(job);
      toggleRecurse(instance, true);
      update();
    };
    const updateComponentPreRender = (instance, nextVNode, optimized) => {
      nextVNode.component = instance;
      const prevProps = instance.vnode.props;
      instance.vnode = nextVNode;
      instance.next = null;
      updateProps(instance, nextVNode.props, prevProps, optimized);
      updateSlots(instance, nextVNode.children, optimized);
      pauseTracking();
      flushPreFlushCbs(instance);
      resetTracking();
    };
    const patchChildren = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized = false) => {
      const c1 = n1 && n1.children;
      const prevShapeFlag = n1 ? n1.shapeFlag : 0;
      const c2 = n2.children;
      const { patchFlag, shapeFlag } = n2;
      if (patchFlag > 0) {
        if (patchFlag & 128) {
          patchKeyedChildren(
            c1,
            c2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
          return;
        } else if (patchFlag & 256) {
          patchUnkeyedChildren(
            c1,
            c2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
          return;
        }
      }
      if (shapeFlag & 8) {
        if (prevShapeFlag & 16) {
          unmountChildren(c1, parentComponent, parentSuspense);
        }
        if (c2 !== c1) {
          hostSetElementText(container, c2);
        }
      } else {
        if (prevShapeFlag & 16) {
          if (shapeFlag & 16) {
            patchKeyedChildren(
              c1,
              c2,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
          } else {
            unmountChildren(c1, parentComponent, parentSuspense, true);
          }
        } else {
          if (prevShapeFlag & 8) {
            hostSetElementText(container, "");
          }
          if (shapeFlag & 16) {
            mountChildren(
              c2,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
          }
        }
      }
    };
    const patchUnkeyedChildren = (c1, c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      c1 = c1 || EMPTY_ARR;
      c2 = c2 || EMPTY_ARR;
      const oldLength = c1.length;
      const newLength = c2.length;
      const commonLength = Math.min(oldLength, newLength);
      let i;
      for (i = 0; i < commonLength; i++) {
        const nextChild = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
        patch(
          c1[i],
          nextChild,
          container,
          null,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
      }
      if (oldLength > newLength) {
        unmountChildren(
          c1,
          parentComponent,
          parentSuspense,
          true,
          false,
          commonLength
        );
      } else {
        mountChildren(
          c2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized,
          commonLength
        );
      }
    };
    const patchKeyedChildren = (c1, c2, container, parentAnchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      let i = 0;
      const l2 = c2.length;
      let e1 = c1.length - 1;
      let e2 = l2 - 1;
      while (i <= e1 && i <= e2) {
        const n1 = c1[i];
        const n2 = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
        if (isSameVNodeType(n1, n2)) {
          patch(
            n1,
            n2,
            container,
            null,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        } else {
          break;
        }
        i++;
      }
      while (i <= e1 && i <= e2) {
        const n1 = c1[e1];
        const n2 = c2[e2] = optimized ? cloneIfMounted(c2[e2]) : normalizeVNode(c2[e2]);
        if (isSameVNodeType(n1, n2)) {
          patch(
            n1,
            n2,
            container,
            null,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        } else {
          break;
        }
        e1--;
        e2--;
      }
      if (i > e1) {
        if (i <= e2) {
          const nextPos = e2 + 1;
          const anchor = nextPos < l2 ? c2[nextPos].el : parentAnchor;
          while (i <= e2) {
            patch(
              null,
              c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]),
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
            i++;
          }
        }
      } else if (i > e2) {
        while (i <= e1) {
          unmount(c1[i], parentComponent, parentSuspense, true);
          i++;
        }
      } else {
        const s1 = i;
        const s2 = i;
        const keyToNewIndexMap = /* @__PURE__ */ new Map();
        for (i = s2; i <= e2; i++) {
          const nextChild = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
          if (nextChild.key != null) {
            keyToNewIndexMap.set(nextChild.key, i);
          }
        }
        let j;
        let patched = 0;
        const toBePatched = e2 - s2 + 1;
        let moved = false;
        let maxNewIndexSoFar = 0;
        const newIndexToOldIndexMap = new Array(toBePatched);
        for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0;
        for (i = s1; i <= e1; i++) {
          const prevChild = c1[i];
          if (patched >= toBePatched) {
            unmount(prevChild, parentComponent, parentSuspense, true);
            continue;
          }
          let newIndex;
          if (prevChild.key != null) {
            newIndex = keyToNewIndexMap.get(prevChild.key);
          } else {
            for (j = s2; j <= e2; j++) {
              if (newIndexToOldIndexMap[j - s2] === 0 && isSameVNodeType(prevChild, c2[j])) {
                newIndex = j;
                break;
              }
            }
          }
          if (newIndex === void 0) {
            unmount(prevChild, parentComponent, parentSuspense, true);
          } else {
            newIndexToOldIndexMap[newIndex - s2] = i + 1;
            if (newIndex >= maxNewIndexSoFar) {
              maxNewIndexSoFar = newIndex;
            } else {
              moved = true;
            }
            patch(
              prevChild,
              c2[newIndex],
              container,
              null,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
            patched++;
          }
        }
        const increasingNewIndexSequence = moved ? getSequence(newIndexToOldIndexMap) : EMPTY_ARR;
        j = increasingNewIndexSequence.length - 1;
        for (i = toBePatched - 1; i >= 0; i--) {
          const nextIndex = s2 + i;
          const nextChild = c2[nextIndex];
          const anchorVNode = c2[nextIndex + 1];
          const anchor = nextIndex + 1 < l2 ? (
            // #13559, #14173 fallback to el placeholder for unresolved async component
            anchorVNode.el || resolveAsyncComponentPlaceholder(anchorVNode)
          ) : parentAnchor;
          if (newIndexToOldIndexMap[i] === 0) {
            patch(
              null,
              nextChild,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
          } else if (moved) {
            if (j < 0 || i !== increasingNewIndexSequence[j]) {
              move(nextChild, container, anchor, 2);
            } else {
              j--;
            }
          }
        }
      }
    };
    const move = (vnode, container, anchor, moveType, parentSuspense = null) => {
      const { el, type, transition, children, shapeFlag } = vnode;
      if (shapeFlag & 6) {
        move(vnode.component.subTree, container, anchor, moveType);
        return;
      }
      if (shapeFlag & 128) {
        vnode.suspense.move(container, anchor, moveType);
        return;
      }
      if (shapeFlag & 64) {
        type.move(vnode, container, anchor, internals);
        return;
      }
      if (type === Fragment) {
        hostInsert(el, container, anchor);
        for (let i = 0; i < children.length; i++) {
          move(children[i], container, anchor, moveType);
        }
        hostInsert(vnode.anchor, container, anchor);
        return;
      }
      if (type === Static) {
        moveStaticNode(vnode, container, anchor);
        return;
      }
      const needTransition2 = moveType !== 2 && shapeFlag & 1 && transition;
      if (needTransition2) {
        if (moveType === 0) {
          if (transition.persisted && !el[leaveCbKey]) {
            hostInsert(el, container, anchor);
          } else {
            transition.beforeEnter(el);
            hostInsert(el, container, anchor);
            queuePostRenderEffect(() => transition.enter(el), parentSuspense);
          }
        } else {
          const { leave, delayLeave, afterLeave } = transition;
          const remove22 = () => {
            if (vnode.ctx.isUnmounted) {
              hostRemove(el);
            } else {
              hostInsert(el, container, anchor);
            }
          };
          const performLeave = () => {
            const wasLeaving = el._isLeaving || !!el[leaveCbKey];
            if (el._isLeaving) {
              el[leaveCbKey](
                true
                /* cancelled */
              );
            }
            if (transition.persisted && !wasLeaving) {
              remove22();
            } else {
              leave(el, () => {
                remove22();
                afterLeave && afterLeave();
              });
            }
          };
          if (delayLeave) {
            delayLeave(el, remove22, performLeave);
          } else {
            performLeave();
          }
        }
      } else {
        hostInsert(el, container, anchor);
      }
    };
    const unmount = (vnode, parentComponent, parentSuspense, doRemove = false, optimized = false) => {
      const {
        type,
        props,
        ref: ref3,
        children,
        dynamicChildren,
        shapeFlag,
        patchFlag,
        dirs,
        cacheIndex,
        memo
      } = vnode;
      if (patchFlag === -2 || dynamicChildren && dynamicChildren.hasOnce) {
        optimized = false;
      }
      if (ref3 != null) {
        pauseTracking();
        setRef(ref3, null, parentSuspense, vnode, true);
        resetTracking();
      }
      if (cacheIndex != null && (!vnode.ctx || vnode.ctx === parentComponent)) {
        parentComponent.renderCache[cacheIndex] = void 0;
      }
      if (shapeFlag & 256 && parentComponent.ctx.deactivate(vnode)) {
        return;
      }
      const shouldInvokeDirs = shapeFlag & 1 && dirs;
      const shouldInvokeVnodeHook = !isAsyncWrapper(vnode);
      let vnodeHook;
      if (shouldInvokeVnodeHook && (vnodeHook = props && props.onVnodeBeforeUnmount)) {
        invokeVNodeHook(vnodeHook, parentComponent, vnode);
      }
      if (shapeFlag & 6) {
        unmountComponent(vnode.component, parentSuspense, doRemove);
      } else {
        if (shapeFlag & 128) {
          vnode.suspense.unmount(parentSuspense, doRemove);
          return;
        }
        if (shouldInvokeDirs) {
          invokeDirectiveHook(vnode, null, parentComponent, "beforeUnmount");
        }
        if (shapeFlag & 64) {
          vnode.type.remove(
            vnode,
            parentComponent,
            parentSuspense,
            internals,
            doRemove
          );
        } else if (dynamicChildren && // #5154
        // when v-once is used inside a block, setBlockTracking(-1) marks the
        // parent block with hasOnce: true
        // so that it doesn't take the fast path during unmount - otherwise
        // components nested in v-once are never unmounted.
        !dynamicChildren.hasOnce && // #1153: fast path should not be taken for non-stable (v-for) fragments
        (type !== Fragment || patchFlag > 0 && patchFlag & 64)) {
          unmountChildren(
            dynamicChildren,
            parentComponent,
            parentSuspense,
            false,
            true
          );
        } else if (type === Fragment && patchFlag & (128 | 256) || !optimized && shapeFlag & 16) {
          unmountChildren(children, parentComponent, parentSuspense);
        }
        if (doRemove) {
          remove2(vnode);
        }
      }
      const shouldInvalidateMemo = memo != null && cacheIndex == null;
      if (shouldInvokeVnodeHook && (vnodeHook = props && props.onVnodeUnmounted) || shouldInvokeDirs || shouldInvalidateMemo) {
        queuePostRenderEffect(() => {
          vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
          shouldInvokeDirs && invokeDirectiveHook(vnode, null, parentComponent, "unmounted");
          if (shouldInvalidateMemo) {
            vnode.el = null;
          }
        }, parentSuspense);
      }
    };
    const remove2 = (vnode) => {
      const { type, el, anchor, transition } = vnode;
      const isFragment = type === Fragment;
      if (isFragment && !transition) {
        removeFragment(el, anchor);
        return;
      }
      if (type === Static) {
        removeStaticNode(vnode);
        if (transition && !transition.persisted && transition.afterLeave) {
          transition.afterLeave();
        }
        return;
      }
      const leavingNode = isFragment ? getTransitionRoot(vnode) : vnode;
      const performRemove = () => {
        if (isFragment) {
          if (hostParentNode(el)) {
            removeFragment(el, anchor);
          }
        } else {
          hostRemove(el);
        }
        if (transition && !transition.persisted && transition.afterLeave) {
          transition.afterLeave();
        }
      };
      if (leavingNode && leavingNode.shapeFlag & 1 && transition && !transition.persisted) {
        const { leave, delayLeave } = transition;
        const leavingEl = leavingNode.el;
        const performLeave = () => leave(leavingEl, performRemove);
        if (delayLeave) {
          delayLeave(leavingEl, performRemove, performLeave);
        } else {
          performLeave();
        }
      } else {
        performRemove();
      }
    };
    const removeFragment = (cur, end) => {
      let next;
      while (cur !== end) {
        next = hostNextSibling(cur);
        hostRemove(cur);
        cur = next;
      }
      hostRemove(end);
    };
    const unmountComponent = (instance, parentSuspense, doRemove) => {
      const { bum, scope, job, subTree, um, m, a } = instance;
      invalidateMount(m);
      invalidateMount(a);
      if (bum) {
        invokeArrayFns(bum);
      }
      scope.stop();
      if (job) {
        job.flags |= 8;
        unmount(subTree, instance, parentSuspense, doRemove);
      } else if (subTree) {
        subTree.transition = instance.vnode.transition;
        unmount(subTree, instance, parentSuspense, doRemove);
      }
      if (um) {
        queuePostRenderEffect(um, parentSuspense);
      }
      const markUnmounted = () => {
        instance.isUnmounted = true;
      };
      markUnmounted.flags = 16;
      queuePostRenderEffect(markUnmounted, parentSuspense);
    };
    const unmountChildren = (children, parentComponent, parentSuspense, doRemove = false, optimized = false, start = 0) => {
      for (let i = start; i < children.length; i++) {
        unmount(children[i], parentComponent, parentSuspense, doRemove, optimized);
      }
    };
    const getNextHostNode = (vnode) => {
      if (vnode.shapeFlag & 6) {
        return getNextHostNode(vnode.component.subTree);
      }
      if (vnode.shapeFlag & 128) {
        return vnode.suspense.next();
      }
      const el = hostNextSibling(vnode.anchor || vnode.el);
      const teleportEnd = el && el[TeleportEndKey];
      return teleportEnd ? hostNextSibling(teleportEnd) : el;
    };
    const render2 = (vnode, container, namespace) => {
      const minUid = vnode && container._vnode ? void 0 : vnode && vnode.component ? vnode.component.uid : getNextUid();
      flushOnAppMount(() => {
        if (vnode == null) {
          if (container._vnode) {
            unmount(container._vnode, null, null, true);
          }
        } else {
          patch(
            container._vnode || null,
            vnode,
            container,
            null,
            null,
            null,
            namespace
          );
        }
        container._vnode = vnode;
      }, minUid);
    };
    const internals = {
      p: patch,
      um: unmount,
      m: move,
      r: remove2,
      mt: mountComponent,
      mc: mountChildren,
      pc: patchChildren,
      pbc: patchBlockChildren,
      n: getNextHostNode,
      o: options
    };
    let hydrate2;
    let hydrateNode;
    if (createHydrationFns) {
      [hydrate2, hydrateNode] = createHydrationFns(
        internals
      );
    }
    return {
      render: render2,
      hydrate: hydrate2,
      createApp: createAppAPI(render2, hydrate2)
    };
  }
  function resolveChildrenNamespace({ type, props }, currentNamespace) {
    return currentNamespace === "svg" && type === "foreignObject" || currentNamespace === "mathml" && type === "annotation-xml" && props && props.encoding && props.encoding.includes("html") ? void 0 : currentNamespace;
  }
  function toggleRecurse({ effect: effect2, job }, allowed) {
    if (allowed) {
      effect2.flags |= 32;
      job.flags |= 4;
    } else {
      effect2.flags &= -33;
      job.flags &= -5;
    }
  }
  function needTransition(parentSuspense, transition) {
    return (!parentSuspense || parentSuspense && !parentSuspense.pendingBranch) && transition && !transition.persisted;
  }
  function traverseStaticChildren(n1, n2, shallow = false) {
    const ch1 = n1.children;
    const ch2 = n2.children;
    if (isArray(ch1) && isArray(ch2)) {
      for (let i = 0; i < ch1.length; i++) {
        const c1 = ch1[i];
        let c2 = ch2[i];
        if (c2.shapeFlag & 1 && !c2.dynamicChildren) {
          if (c2.patchFlag <= 0 || c2.patchFlag === 32) {
            c2 = ch2[i] = cloneIfMounted(ch2[i]);
            c2.el = c1.el;
          }
          if (!shallow && c2.patchFlag !== -2)
            traverseStaticChildren(c1, c2);
        }
        if (c2.type === Text) {
          if (c2.patchFlag === -1) {
            c2 = ch2[i] = cloneIfMounted(c2);
          }
          c2.el = c1.el;
        }
        if (c2.type === Comment && !c2.el) {
          c2.el = c1.el;
        }
      }
    }
  }
  function getSequence(arr) {
    const p2 = arr.slice();
    const result = [0];
    let i, j, u, v, c;
    const len = arr.length;
    for (i = 0; i < len; i++) {
      const arrI = arr[i];
      if (arrI !== 0) {
        j = result[result.length - 1];
        if (arr[j] < arrI) {
          p2[i] = j;
          result.push(i);
          continue;
        }
        u = 0;
        v = result.length - 1;
        while (u < v) {
          c = u + v >> 1;
          if (arr[result[c]] < arrI) {
            u = c + 1;
          } else {
            v = c;
          }
        }
        if (arrI < arr[result[u]]) {
          if (u > 0) {
            p2[i] = result[u - 1];
          }
          result[u] = i;
        }
      }
    }
    u = result.length;
    v = result[u - 1];
    while (u-- > 0) {
      result[u] = v;
      v = p2[v];
    }
    return result;
  }
  function locateUnresolvedAsyncRoot(instance) {
    const subComponent = instance.subTree.component;
    if (subComponent) {
      if (subComponent.asyncDep && !subComponent.asyncResolved) {
        return subComponent;
      } else {
        return locateUnresolvedAsyncRoot(subComponent);
      }
    }
  }
  function invalidateMount(hooks) {
    if (hooks) {
      for (let i = 0; i < hooks.length; i++)
        hooks[i].flags |= 8;
    }
  }
  function resolveAsyncComponentPlaceholder(anchorVnode) {
    if (anchorVnode.placeholder) {
      return anchorVnode.placeholder;
    }
    const instance = anchorVnode.component;
    if (instance) {
      return resolveAsyncComponentPlaceholder(instance.subTree);
    }
    const suspense = anchorVnode.suspense;
    if (suspense && suspense.activeBranch) {
      return resolveAsyncComponentPlaceholder(suspense.activeBranch);
    }
    return null;
  }
  const isSuspense = (type) => type.__isSuspense;
  let suspenseId = 0;
  const deferredEnterKey = /* @__PURE__ */ Symbol("_deferredEnter");
  const SuspenseImpl = {
    name: "Suspense",
    // In order to make Suspense tree-shakable, we need to avoid importing it
    // directly in the renderer. The renderer checks for the __isSuspense flag
    // on a vnode's type and calls the `process` method, passing in renderer
    // internals.
    __isSuspense: true,
    process(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, rendererInternals) {
      if (n1 == null) {
        mountSuspense(
          n2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized,
          rendererInternals
        );
      } else {
        const suspense = n1.suspense;
        if (parentSuspense && parentSuspense.deps > 0 && !parentSuspense.isHydrating) {
          const owner = suspense.parentComponent;
          const retained = !!owner && owner.suspense === parentSuspense && owner.suspenseId !== parentSuspense.pendingId;
          if (retained ? (
            // deps can outlive the pending branch: skip only while it exists
            parentSuspense.pendingBranch && !isSameVNodeType(
              n2.ssContent,
              suspense.pendingBranch || suspense.activeBranch
            )
          ) : !suspense.isInFallback) {
            n2.suspense = suspense;
            suspense.vnode = n2;
            n2.el = n1.el;
            return;
          }
        }
        patchSuspense(
          n1,
          n2,
          container,
          anchor,
          parentComponent,
          namespace,
          slotScopeIds,
          optimized,
          rendererInternals
        );
      }
    },
    hydrate: hydrateSuspense,
    normalize: normalizeSuspenseChildren
  };
  const Suspense = SuspenseImpl;
  function triggerEvent(vnode, name) {
    const eventListener = vnode.props && vnode.props[name];
    if (isFunction(eventListener)) {
      eventListener();
    }
  }
  function enterDeferred(branch) {
    const enters = [];
    collectDeferredEnters(branch, enters, true);
    if (enters.length) {
      queuePostFlushCb(enters);
    }
  }
  function collectDeferredEnters(vnode, enters, isRoot) {
    const { el, transition, children, shapeFlag } = vnode;
    if (shapeFlag & 6) {
      collectDeferredEnters(vnode.component.subTree, enters, isRoot);
      return;
    }
    if (shapeFlag & (128 | 64)) {
      return;
    }
    if (shapeFlag & 1) {
      if (!isRoot && el && el[deferredEnterKey]) {
        el[deferredEnterKey] = void 0;
        if (transition && !transition.persisted) {
          transition.beforeEnter(el);
          enters.push(() => transition.enter(el));
        }
      }
      isRoot = false;
    }
    if (shapeFlag & 16) {
      for (let i = 0; i < children.length; i++) {
        collectDeferredEnters(children[i], enters, isRoot);
      }
    }
  }
  function mountSuspense(vnode, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, rendererInternals) {
    const {
      p: patch,
      o: { createElement }
    } = rendererInternals;
    const hiddenContainer = createElement("div");
    const suspense = vnode.suspense = createSuspenseBoundary(
      vnode,
      parentSuspense,
      parentComponent,
      container,
      hiddenContainer,
      anchor,
      namespace,
      slotScopeIds,
      optimized,
      rendererInternals
    );
    patch(
      null,
      suspense.pendingBranch = vnode.ssContent,
      hiddenContainer,
      null,
      parentComponent,
      suspense,
      namespace,
      slotScopeIds
    );
    if (suspense.deps > 0) {
      triggerEvent(vnode, "onPending");
      triggerEvent(vnode, "onFallback");
      patch(
        null,
        vnode.ssFallback,
        container,
        anchor,
        parentComponent,
        null,
        // fallback tree will not have suspense context
        namespace,
        slotScopeIds
      );
      setActiveBranch(suspense, vnode.ssFallback);
    } else {
      suspense.resolve(false, true);
    }
  }
  function patchSuspense(n1, n2, container, anchor, parentComponent, namespace, slotScopeIds, optimized, { p: patch, um: unmount, o: { createElement } }) {
    const suspense = n2.suspense = n1.suspense;
    suspense.vnode = n2;
    n2.el = n1.el;
    const newBranch = n2.ssContent;
    const newFallback = n2.ssFallback;
    const { activeBranch, pendingBranch, isInFallback, isHydrating } = suspense;
    if (pendingBranch) {
      suspense.pendingBranch = newBranch;
      if (isSameVNodeType(pendingBranch, newBranch)) {
        suspense.deps++;
        patch(
          pendingBranch,
          newBranch,
          // a hydrating pending branch is adopted SSR DOM, already in place
          isHydrating ? container : suspense.hiddenContainer,
          null,
          parentComponent,
          suspense,
          namespace,
          slotScopeIds,
          optimized
        );
        suspense.deps--;
        if (suspense.deps <= 0) {
          suspense.resolve();
        } else if (isInFallback) {
          if (!isHydrating && !suspense.isFallbackMountPending) {
            patch(
              activeBranch,
              newFallback,
              container,
              anchor,
              parentComponent,
              null,
              // fallback tree will not have suspense context
              namespace,
              slotScopeIds,
              optimized
            );
            setActiveBranch(suspense, newFallback);
          }
        }
      } else {
        suspense.pendingId = suspenseId++;
        if (isHydrating) {
          suspense.isHydrating = false;
          suspense.activeBranch = pendingBranch;
        } else {
          unmount(pendingBranch, parentComponent, suspense);
        }
        suspense.deps = 0;
        discardEffects(suspense);
        suspense.hiddenContainer = createElement("div");
        if (isInFallback) {
          patch(
            null,
            newBranch,
            suspense.hiddenContainer,
            null,
            parentComponent,
            suspense,
            namespace,
            slotScopeIds,
            optimized
          );
          if (suspense.deps <= 0) {
            suspense.resolve();
          } else if (!suspense.isFallbackMountPending) {
            patch(
              activeBranch,
              newFallback,
              container,
              anchor,
              parentComponent,
              null,
              // fallback tree will not have suspense context
              namespace,
              slotScopeIds,
              optimized
            );
            setActiveBranch(suspense, newFallback);
          }
        } else if (activeBranch && isSameVNodeType(activeBranch, newBranch)) {
          patch(
            activeBranch,
            newBranch,
            container,
            anchor,
            parentComponent,
            suspense,
            namespace,
            slotScopeIds,
            optimized
          );
          suspense.resolve(true);
        } else {
          patch(
            null,
            newBranch,
            suspense.hiddenContainer,
            null,
            parentComponent,
            suspense,
            namespace,
            slotScopeIds,
            optimized
          );
          if (suspense.deps <= 0) {
            suspense.resolve();
          }
        }
      }
    } else {
      if (activeBranch && isSameVNodeType(activeBranch, newBranch)) {
        patch(
          activeBranch,
          newBranch,
          container,
          anchor,
          parentComponent,
          suspense,
          namespace,
          slotScopeIds,
          optimized
        );
        setActiveBranch(suspense, newBranch);
      } else {
        triggerEvent(n2, "onPending");
        suspense.pendingBranch = newBranch;
        suspense.pendingId = suspenseId++;
        patch(
          null,
          newBranch,
          suspense.hiddenContainer,
          null,
          parentComponent,
          suspense,
          namespace,
          slotScopeIds,
          optimized
        );
        if (suspense.deps <= 0) {
          suspense.resolve();
        } else {
          const { timeout } = suspense;
          if (timeout > 0) {
            suspense.timeoutTimer = setTimeout(() => {
              suspense.timeoutTimer = void 0;
              suspense.fallback(suspense.vnode.ssFallback);
            }, timeout);
          } else if (timeout === 0) {
            suspense.fallback(newFallback);
          }
        }
      }
    }
  }
  function createSuspenseBoundary(vnode, parentSuspense, parentComponent, container, hiddenContainer, anchor, namespace, slotScopeIds, optimized, rendererInternals, isHydrating = false) {
    const {
      p: patch,
      m: move,
      um: unmount,
      n: next,
      o: { parentNode, remove: remove2 }
    } = rendererInternals;
    let parentSuspenseId;
    const isSuspensible = isVNodeSuspensible(vnode);
    if (isSuspensible) {
      if (parentSuspense && parentSuspense.pendingBranch) {
        parentSuspenseId = parentSuspense.pendingId;
        parentSuspense.deps++;
      }
    }
    const timeout = vnode.props ? toNumber(vnode.props.timeout) : void 0;
    const initialAnchor = anchor;
    const suspense = {
      vnode,
      parent: parentSuspense,
      parentComponent,
      namespace,
      container,
      hiddenContainer,
      deps: 0,
      pendingId: suspenseId++,
      timeout: typeof timeout === "number" ? timeout : -1,
      timeoutTimer: void 0,
      activeBranch: null,
      isFallbackMountPending: false,
      pendingBranch: null,
      isInFallback: !isHydrating,
      isHydrating,
      isUnmounted: false,
      effects: [],
      resolve(resume = false, sync = false) {
        const {
          vnode: vnode2,
          activeBranch,
          pendingBranch,
          pendingId,
          effects,
          parentComponent: parentComponent2,
          container: container2,
          isInFallback
        } = suspense;
        let delayEnter = false;
        if (suspense.isHydrating) {
          suspense.isHydrating = false;
        } else if (!resume) {
          delayEnter = activeBranch && pendingBranch.transition && pendingBranch.transition.mode === "out-in";
          let hasUpdatedAnchor = false;
          if (delayEnter) {
            activeBranch.transition.afterLeave = () => {
              if (pendingId === suspense.pendingId && !suspense.isUnmounted) {
                enterDeferred(pendingBranch);
                move(
                  pendingBranch,
                  container2,
                  anchor === initialAnchor && !hasUpdatedAnchor ? next(activeBranch) : anchor,
                  0
                );
                queuePostFlushCb(effects);
                if (isInFallback && vnode2.ssFallback) {
                  vnode2.ssFallback.el = null;
                }
              }
            };
          }
          if (activeBranch && !suspense.isFallbackMountPending) {
            if (parentNode(
              activeBranch.el || resolveAsyncComponentPlaceholder(activeBranch)
            ) === container2) {
              anchor = next(activeBranch);
              hasUpdatedAnchor = true;
            }
            unmount(activeBranch, parentComponent2, suspense, true);
            if (!delayEnter && isInFallback && vnode2.ssFallback) {
              queuePostRenderEffect(() => vnode2.ssFallback.el = null, suspense);
            }
          }
          if (!delayEnter) {
            enterDeferred(pendingBranch);
            move(pendingBranch, container2, anchor, 0);
          }
        }
        clearTimeout(suspense.timeoutTimer);
        suspense.timeoutTimer = void 0;
        suspense.isFallbackMountPending = false;
        setActiveBranch(suspense, pendingBranch);
        suspense.pendingBranch = null;
        suspense.isInFallback = false;
        let kept = 0;
        for (let i = 0; i < effects.length; i++) {
          const effect2 = effects[i];
          if (effect2.flags & 32) {
            queuePostFlushCb(effect2);
          } else {
            effects[kept++] = effect2;
          }
        }
        effects.length = kept;
        let parent = suspense.parent;
        let hasUnresolvedAncestor = false;
        while (parent) {
          if (parent.pendingBranch) {
            for (let i = 0; i < effects.length; i++) {
              parent.effects.push(effects[i]);
            }
            hasUnresolvedAncestor = true;
            break;
          }
          parent = parent.parent;
        }
        if (!hasUnresolvedAncestor && !delayEnter) {
          queuePostFlushCb(effects);
        }
        suspense.effects = [];
        if (isSuspensible) {
          if (parentSuspense && parentSuspense.pendingBranch && parentSuspenseId === parentSuspense.pendingId) {
            parentSuspenseId = void 0;
            parentSuspense.deps--;
            if (parentSuspense.deps === 0 && !sync) {
              parentSuspense.resolve();
            }
          }
        }
        triggerEvent(vnode2, "onResolve");
      },
      fallback(fallbackVNode) {
        if (suspense.isUnmounted || !suspense.pendingBranch) {
          return;
        }
        const { vnode: vnode2, activeBranch, parentComponent: parentComponent2, container: container2, namespace: namespace2 } = suspense;
        triggerEvent(vnode2, "onFallback");
        const anchor2 = next(activeBranch);
        const mountFallback = () => {
          suspense.isFallbackMountPending = false;
          if (suspense.isUnmounted || !suspense.isInFallback) {
            return;
          }
          const latestFallback = suspense.vnode.ssFallback;
          patch(
            null,
            latestFallback,
            container2,
            anchor2,
            parentComponent2,
            null,
            // fallback tree will not have suspense context
            namespace2,
            slotScopeIds,
            optimized
          );
          setActiveBranch(suspense, latestFallback);
        };
        const delayEnter = fallbackVNode.transition && fallbackVNode.transition.mode === "out-in";
        if (delayEnter) {
          suspense.isFallbackMountPending = true;
          activeBranch.transition.afterLeave = mountFallback;
        }
        suspense.isInFallback = true;
        unmount(
          activeBranch,
          parentComponent2,
          null,
          // no suspense so unmount hooks fire now
          true
          // shouldRemove
        );
        if (!delayEnter) {
          mountFallback();
        }
      },
      move(container2, anchor2, type) {
        suspense.activeBranch && move(suspense.activeBranch, container2, anchor2, type);
        suspense.container = container2;
      },
      next() {
        return suspense.activeBranch && next(suspense.activeBranch);
      },
      // `namespace` intentionally shadows the boundary's own: the dep must be
      // mounted with the namespace of the position it was rendered at, which can
      // differ from the boundary's (e.g. a component nested inside an <svg>).
      registerDep(instance, setupRenderEffect, optimized2, namespace2) {
        const isInPendingSuspense = !!suspense.pendingBranch;
        if (isInPendingSuspense) {
          suspense.deps++;
        }
        const hydratedEl = instance.vnode.el;
        const render2 = (asyncSetupResult) => {
          instance.asyncResolved = true;
          const { vnode: vnode2 } = instance;
          handleSetupResult(instance, asyncSetupResult, false);
          if (hydratedEl) {
            vnode2.el = hydratedEl;
          }
          const placeholder = !hydratedEl && instance.subTree.el;
          setupRenderEffect(
            instance,
            vnode2,
            // component may have been moved before resolve.
            // if this is not a hydration, instance.subTree will be the comment
            // placeholder.
            parentNode(hydratedEl || instance.subTree.el),
            // anchor will not be used if this is hydration, so only need to
            // consider the comment placeholder case.
            hydratedEl ? null : next(instance.subTree),
            suspense,
            namespace2,
            optimized2
          );
          if (placeholder) {
            vnode2.placeholder = null;
            remove2(placeholder);
          }
          updateHOCHostEl(instance, vnode2.el);
        };
        instance.asyncDep.catch((err) => {
          handleError(err, instance, 0, false, true);
          return () => null;
        }).then((asyncSetupResult) => {
          if (instance.isUnmounted || suspense.isUnmounted) {
            return;
          }
          const isPendingDep = isInPendingSuspense && suspense.pendingId === instance.suspenseId;
          unsetCurrentInstance();
          if (!instance.scope.active) {
            if (isPendingDep && --suspense.deps === 0) {
              suspense.resolve();
            }
            return;
          }
          if (!isPendingDep && suspense.pendingBranch) {
            const job = () => {
              if (instance.isUnmounted || suspense.isUnmounted || !instance.scope.active) {
                return;
              }
              if (suspense.pendingBranch) {
                queueEffectWithSuspense(job, suspense);
              } else {
                render2(asyncSetupResult);
              }
            };
            job.flags = 16 | 32;
            queueEffectWithSuspense(job, suspense);
            return;
          }
          render2(asyncSetupResult);
          if (isPendingDep && --suspense.deps === 0) {
            suspense.resolve();
          }
        });
      },
      unmount(parentSuspense2, doRemove) {
        suspense.isUnmounted = true;
        clearTimeout(suspense.timeoutTimer);
        suspense.timeoutTimer = void 0;
        if (parentSuspenseId !== void 0) {
          const parent = suspense.parent;
          const pendingId = parentSuspenseId;
          parentSuspenseId = void 0;
          queuePostFlushCb(() => {
            if (parent.pendingId === pendingId && !parent.isUnmounted && --parent.deps === 0) {
              parent.resolve();
            }
          });
        }
        if (suspense.activeBranch) {
          unmount(
            suspense.activeBranch,
            parentComponent,
            parentSuspense2,
            doRemove
          );
        }
        if (suspense.pendingBranch) {
          unmount(suspense.pendingBranch, parentComponent, suspense, doRemove);
          discardEffects(suspense);
        }
      }
    };
    return suspense;
  }
  function hydrateSuspense(node, vnode, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, rendererInternals, hydrateNode) {
    const suspense = vnode.suspense = createSuspenseBoundary(
      vnode,
      parentSuspense,
      parentComponent,
      node.parentNode,
      // eslint-disable-next-line no-restricted-globals
      document.createElement("div"),
      null,
      namespace,
      slotScopeIds,
      optimized,
      rendererInternals,
      true
    );
    const result = hydrateNode(
      node,
      suspense.pendingBranch = vnode.ssContent,
      parentComponent,
      suspense,
      slotScopeIds,
      optimized
    );
    if (suspense.deps === 0) {
      suspense.resolve(false, true);
    }
    return result;
  }
  function normalizeSuspenseChildren(vnode) {
    const { shapeFlag, children } = vnode;
    const isSlotChildren = shapeFlag & 32;
    vnode.ssContent = normalizeSuspenseSlot(
      isSlotChildren ? children.default : children
    );
    vnode.ssFallback = isSlotChildren ? normalizeSuspenseSlot(children.fallback) : createVNode(Comment);
  }
  function normalizeSuspenseSlot(s) {
    let block;
    if (isFunction(s)) {
      const trackBlock = isBlockTreeEnabled && s._c;
      if (trackBlock) {
        s._d = false;
        openBlock();
      }
      s = s();
      if (trackBlock) {
        s._d = true;
        block = currentBlock;
        closeBlock();
      }
    }
    if (isArray(s)) {
      const singleChild = filterSingleRoot(s);
      s = singleChild;
    }
    s = normalizeVNode(s);
    if (block && !s.dynamicChildren) {
      s.dynamicChildren = block.filter((c) => c !== s);
    }
    return s;
  }
  function discardEffects(suspense) {
    const { effects } = suspense;
    for (let i = 0; i < effects.length; i++) {
      const effect2 = effects[i];
      if (effect2.flags & 16) {
        queuePostFlushCb(effect2);
      }
    }
    effects.length = 0;
  }
  function queueEffectWithSuspense(fn, suspense) {
    if (suspense && suspense.pendingBranch) {
      if (isArray(fn)) {
        suspense.effects.push(...fn);
      } else {
        suspense.effects.push(fn);
      }
    } else {
      queuePostFlushCb(fn);
    }
  }
  function setActiveBranch(suspense, branch) {
    suspense.activeBranch = branch;
    const { vnode, parentComponent } = suspense;
    let el = branch.el;
    while (!el && branch.component) {
      branch = branch.component.subTree;
      el = branch.el;
    }
    vnode.el = el;
    if (parentComponent && parentComponent.subTree === vnode) {
      parentComponent.vnode.el = el;
      updateHOCHostEl(parentComponent, el);
    }
  }
  function isVNodeSuspensible(vnode) {
    const suspensible = vnode.props && vnode.props.suspensible;
    return suspensible != null && suspensible !== false;
  }
  const Fragment = /* @__PURE__ */ Symbol.for("v-fgt");
  const Text = /* @__PURE__ */ Symbol.for("v-txt");
  const Comment = /* @__PURE__ */ Symbol.for("v-cmt");
  const Static = /* @__PURE__ */ Symbol.for("v-stc");
  const blockStack = [];
  let currentBlock = null;
  function openBlock(disableTracking = false) {
    blockStack.push(currentBlock = disableTracking ? null : []);
  }
  function closeBlock() {
    blockStack.pop();
    currentBlock = blockStack[blockStack.length - 1] || null;
  }
  let isBlockTreeEnabled = 1;
  function setBlockTracking(value, inVOnce = false) {
    isBlockTreeEnabled += value;
    if (value < 0 && currentBlock && inVOnce) {
      currentBlock.hasOnce = true;
    }
  }
  function setupBlock(vnode) {
    vnode.dynamicChildren = isBlockTreeEnabled > 0 ? currentBlock || EMPTY_ARR : null;
    closeBlock();
    if (isBlockTreeEnabled > 0 && currentBlock) {
      currentBlock.push(vnode);
    }
    return vnode;
  }
  function createElementBlock(type, props, children, patchFlag, dynamicProps, shapeFlag) {
    return setupBlock(
      createBaseVNode(
        type,
        props,
        children,
        patchFlag,
        dynamicProps,
        shapeFlag,
        true
      )
    );
  }
  function createBlock(type, props, children, patchFlag, dynamicProps) {
    return setupBlock(
      createVNode(
        type,
        props,
        children,
        patchFlag,
        dynamicProps,
        true
      )
    );
  }
  function isVNode(value) {
    return value ? value.__v_isVNode === true : false;
  }
  function isSameVNodeType(n1, n2) {
    return n1.type === n2.type && n1.key === n2.key;
  }
  function transformVNodeArgs(transformer) {
  }
  const normalizeKey = ({ key }) => key != null ? key : null;
  const normalizeRef = ({
    ref: ref3,
    ref_key,
    ref_for
  }) => {
    if (typeof ref3 === "number") {
      ref3 = "" + ref3;
    }
    return ref3 != null ? isString(ref3) || /* @__PURE__ */ isRef(ref3) || isFunction(ref3) ? { i: currentRenderingInstance, r: ref3, k: ref_key, f: !!ref_for } : ref3 : null;
  };
  function createBaseVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, shapeFlag = type === Fragment ? 0 : 1, isBlockNode = false, needFullChildrenNormalization = false) {
    const vnode = {
      __v_isVNode: true,
      __v_skip: true,
      type,
      props,
      key: props && normalizeKey(props),
      ref: props && normalizeRef(props),
      scopeId: currentScopeId,
      slotScopeIds: null,
      children,
      component: null,
      suspense: null,
      ssContent: null,
      ssFallback: null,
      dirs: null,
      transition: null,
      el: null,
      anchor: null,
      target: null,
      targetStart: null,
      targetAnchor: null,
      staticCount: 0,
      shapeFlag,
      patchFlag,
      dynamicProps,
      dynamicChildren: null,
      appContext: null,
      ctx: currentRenderingInstance
    };
    if (needFullChildrenNormalization) {
      normalizeChildren(vnode, children);
      if (shapeFlag & 128) {
        type.normalize(vnode);
      }
    } else if (children) {
      vnode.shapeFlag |= isString(children) ? 8 : 16;
    }
    if (isBlockTreeEnabled > 0 && // avoid a block node from tracking itself
    !isBlockNode && // has current parent block
    currentBlock && // presence of a patch flag indicates this node needs patching on updates.
    // component nodes also should always be patched, because even if the
    // component doesn't need to update, it needs to persist the instance on to
    // the next vnode so that it can be properly unmounted later.
    (vnode.patchFlag > 0 || shapeFlag & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
    // vnode should not be considered dynamic due to handler caching.
    vnode.patchFlag !== 32) {
      currentBlock.push(vnode);
    }
    return vnode;
  }
  const createVNode = _createVNode;
  function _createVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, isBlockNode = false) {
    if (!type || type === NULL_DYNAMIC_COMPONENT) {
      type = Comment;
    }
    if (isVNode(type)) {
      const cloned = cloneVNode(
        type,
        props,
        true
        /* mergeRef: true */
      );
      if (children) {
        normalizeChildren(cloned, children);
      }
      if (isBlockTreeEnabled > 0 && !isBlockNode && currentBlock) {
        if (cloned.shapeFlag & 6) {
          currentBlock[currentBlock.indexOf(type)] = cloned;
        } else {
          currentBlock.push(cloned);
        }
      }
      cloned.patchFlag = -2;
      return cloned;
    }
    if (isClassComponent(type)) {
      type = type.__vccOpts;
    }
    if (props) {
      props = guardReactiveProps(props);
      let { class: klass, style } = props;
      if (klass && !isString(klass)) {
        props.class = normalizeClass(klass);
      }
      if (isObject(style)) {
        if (/* @__PURE__ */ isProxy(style) && !isArray(style)) {
          style = extend({}, style);
        }
        props.style = normalizeStyle(style);
      }
    }
    const shapeFlag = isString(type) ? 1 : isSuspense(type) ? 128 : isTeleport(type) ? 64 : isObject(type) ? 4 : isFunction(type) ? 2 : 0;
    return createBaseVNode(
      type,
      props,
      children,
      patchFlag,
      dynamicProps,
      shapeFlag,
      isBlockNode,
      true
    );
  }
  function guardReactiveProps(props) {
    if (!props) return null;
    if (/* @__PURE__ */ isProxy(props)) return extend({}, props);
    return isInternalObject(props) ? extend({}, props[rawAttrsKey] || props) : props;
  }
  function cloneVNode(vnode, extraProps, mergeRef = false, cloneTransition = false) {
    const { props, ref: ref3, patchFlag, children, transition } = vnode;
    const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props;
    const cloned = {
      __v_isVNode: true,
      __v_skip: true,
      type: vnode.type,
      props: mergedProps,
      key: mergedProps && normalizeKey(mergedProps),
      ref: extraProps && extraProps.ref ? (
        // #2078 in the case of <component :is="vnode" ref="extra"/>
        // if the vnode itself already has a ref, cloneVNode will need to merge
        // the refs so the single vnode can be set on multiple refs
        mergeRef && ref3 ? isArray(ref3) ? ref3.concat(normalizeRef(extraProps)) : [ref3, normalizeRef(extraProps)] : normalizeRef(extraProps)
      ) : ref3,
      scopeId: vnode.scopeId,
      slotScopeIds: vnode.slotScopeIds,
      children,
      target: vnode.target,
      targetStart: vnode.targetStart,
      targetAnchor: vnode.targetAnchor,
      staticCount: vnode.staticCount,
      shapeFlag: vnode.shapeFlag,
      // if the vnode is cloned with extra props, we can no longer assume its
      // existing patch flag to be reliable and need to add the FULL_PROPS flag.
      // note: preserve flag for fragments since they use the flag for children
      // fast paths only.
      patchFlag: extraProps && vnode.type !== Fragment ? patchFlag === -1 ? 16 : patchFlag | 16 : patchFlag,
      dynamicProps: vnode.dynamicProps,
      dynamicChildren: vnode.dynamicChildren,
      appContext: vnode.appContext,
      dirs: vnode.dirs,
      transition,
      // These should technically only be non-null on mounted VNodes. However,
      // they *should* be copied for kept-alive vnodes. So we just always copy
      // them since them being non-null during a mount doesn't affect the logic as
      // they will simply be overwritten.
      component: vnode.component,
      suspense: vnode.suspense,
      ssContent: vnode.ssContent && cloneVNode(vnode.ssContent),
      ssFallback: vnode.ssFallback && cloneVNode(vnode.ssFallback),
      placeholder: vnode.placeholder,
      el: vnode.el,
      anchor: vnode.anchor,
      ctx: vnode.ctx,
      ce: vnode.ce,
      cacheIndex: vnode.cacheIndex
    };
    if (transition && cloneTransition) {
      setTransitionHooks(
        cloned,
        transition.clone(cloned)
      );
    }
    return cloned;
  }
  function createTextVNode(text = " ", flag = 0) {
    return createVNode(Text, null, text, flag);
  }
  function createStaticVNode(content, numberOfNodes) {
    const vnode = createVNode(Static, null, content);
    vnode.staticCount = numberOfNodes;
    return vnode;
  }
  function createCommentVNode(text = "", asBlock = false) {
    return asBlock ? (openBlock(), createBlock(Comment, null, text)) : createVNode(Comment, null, text);
  }
  function normalizeVNode(child) {
    if (child == null || typeof child === "boolean") {
      return createVNode(Comment);
    } else if (isArray(child)) {
      return createVNode(
        Fragment,
        null,
        // #3666, avoid reference pollution when reusing vnode
        child.slice()
      );
    } else if (isVNode(child)) {
      return cloneIfMounted(child);
    } else {
      return createVNode(Text, null, String(child));
    }
  }
  function cloneIfMounted(child) {
    return child.el === null && child.patchFlag !== -1 || child.memo ? child : cloneVNode(child);
  }
  function normalizeChildren(vnode, children) {
    let type = 0;
    const { shapeFlag } = vnode;
    if (children == null) {
      children = null;
    } else if (isArray(children)) {
      type = 16;
    } else if (typeof children === "object") {
      if (shapeFlag & (1 | 64)) {
        const slot = children.default;
        if (slot) {
          slot._c && (slot._d = false);
          normalizeChildren(vnode, slot());
          slot._c && (slot._d = true);
        }
        return;
      } else {
        type = 32;
        const slotFlag = children._;
        if (!slotFlag && !isInternalObject(children)) {
          children._ctx = currentRenderingInstance;
        } else if (slotFlag === 3 && currentRenderingInstance) {
          if (currentRenderingInstance.slots._ === 1) {
            children._ = 1;
          } else {
            children._ = 2;
            vnode.patchFlag |= 1024;
          }
        }
      }
    } else if (isFunction(children)) {
      if (shapeFlag & (1 | 64)) {
        normalizeChildren(vnode, { default: children });
        return;
      }
      children = { default: children, _ctx: currentRenderingInstance };
      type = 32;
    } else {
      children = String(children);
      if (shapeFlag & 64) {
        type = 16;
        children = [createTextVNode(children)];
      } else {
        type = 8;
      }
    }
    vnode.children = children;
    vnode.shapeFlag |= type;
  }
  function mergeProps(...args) {
    const ret = {};
    for (let i = 0; i < args.length; i++) {
      const toMerge = args[i];
      for (const key in toMerge) {
        if (key === "class") {
          if (ret.class !== toMerge.class) {
            ret.class = normalizeClass([ret.class, toMerge.class]);
          }
        } else if (key === "style") {
          ret.style = normalizeStyle([ret.style, toMerge.style]);
        } else if (isOn(key)) {
          const existing = ret[key];
          const incoming = toMerge[key];
          if (incoming && existing !== incoming && !(isArray(existing) && existing.includes(incoming))) {
            ret[key] = existing ? [].concat(existing, incoming) : incoming;
          } else if (incoming == null && existing == null && // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
          // the model listener.
          !isModelListener(key)) {
            ret[key] = incoming;
          }
        } else if (key !== "") {
          ret[key] = toMerge[key];
        }
      }
    }
    return ret;
  }
  function invokeVNodeHook(hook, instance, vnode, prevVNode = null) {
    callWithAsyncErrorHandling(hook, instance, 7, [
      vnode,
      prevVNode
    ]);
  }
  const emptyAppContext = /* @__PURE__ */ createAppContext();
  let uid = 0;
  function getNextUid() {
    return uid;
  }
  function createComponentInstance(vnode, parent, suspense) {
    const type = vnode.type;
    const appContext = (parent ? parent.appContext : vnode.appContext) || emptyAppContext;
    const instance = {
      uid: uid++,
      vnode,
      type,
      parent,
      appContext,
      root: null,
      // to be immediately set
      next: null,
      subTree: null,
      // will be set synchronously right after creation
      effect: null,
      update: null,
      // will be set synchronously right after creation
      job: null,
      scope: new EffectScope(
        true
        /* detached */
      ),
      render: null,
      proxy: null,
      exposed: null,
      exposeProxy: null,
      withProxy: null,
      provides: parent ? parent.provides : Object.create(appContext.provides),
      ids: parent ? parent.ids : ["", 0, 0],
      accessCache: null,
      renderCache: [],
      // local resolved assets
      components: null,
      directives: null,
      // resolved props and emits options
      propsOptions: normalizePropsOptions(type, appContext),
      emitsOptions: normalizeEmitsOptions(type, appContext),
      // emit
      emit: null,
      // to be set immediately
      emitted: null,
      // props default value
      propsDefaults: EMPTY_OBJ,
      // inheritAttrs
      inheritAttrs: type.inheritAttrs,
      // state
      ctx: EMPTY_OBJ,
      data: EMPTY_OBJ,
      props: EMPTY_OBJ,
      attrs: EMPTY_OBJ,
      slots: EMPTY_OBJ,
      refs: EMPTY_OBJ,
      setupState: EMPTY_OBJ,
      setupContext: null,
      // suspense related
      suspense,
      suspenseId: suspense ? suspense.pendingId : 0,
      asyncDep: null,
      asyncResolved: false,
      // lifecycle hooks
      // not using enums here because it results in computed properties
      isMounted: false,
      isUnmounted: false,
      isDeactivated: false,
      bc: null,
      c: null,
      bm: null,
      m: null,
      bu: null,
      u: null,
      um: null,
      bum: null,
      da: null,
      a: null,
      rtg: null,
      rtc: null,
      ec: null,
      sp: null
    };
    {
      instance.ctx = { _: instance };
    }
    instance.root = parent ? parent.root : instance;
    instance.emit = emit.bind(null, instance);
    if (vnode.ce) {
      vnode.ce(instance);
    }
    return instance;
  }
  let currentInstance = null;
  const getCurrentInstance = () => currentInstance || currentRenderingInstance;
  let internalSetCurrentInstance;
  let setInSSRSetupState;
  {
    const g = getGlobalThis();
    const registerGlobalSetter = (key, setter) => {
      let setters;
      if (!(setters = g[key])) setters = g[key] = [];
      setters.push(setter);
      return (v) => {
        if (setters.length > 1) setters.forEach((set) => set(v));
        else setters[0](v);
      };
    };
    internalSetCurrentInstance = registerGlobalSetter(
      `__VUE_INSTANCE_SETTERS__`,
      (v) => currentInstance = v
    );
    setInSSRSetupState = registerGlobalSetter(
      `__VUE_SSR_SETTERS__`,
      (v) => isInSSRComponentSetup = v
    );
  }
  const setCurrentInstance = (instance) => {
    const prev = currentInstance;
    internalSetCurrentInstance(instance);
    instance.scope.on();
    return () => {
      instance.scope.off();
      internalSetCurrentInstance(prev);
    };
  };
  const unsetCurrentInstance = () => {
    currentInstance && currentInstance.scope.off();
    internalSetCurrentInstance(null);
  };
  function isStatefulComponent(instance) {
    return instance.vnode.shapeFlag & 4;
  }
  let isInSSRComponentSetup = false;
  function setupComponent(instance, isSSR = false, optimized = false) {
    isSSR && setInSSRSetupState(isSSR);
    const { props, children } = instance.vnode;
    const isStateful = isStatefulComponent(instance);
    initProps(instance, props, isStateful, isSSR);
    initSlots(instance, children, optimized || isSSR);
    const setupResult = isStateful ? setupStatefulComponent(instance, isSSR) : void 0;
    isSSR && setInSSRSetupState(false);
    return setupResult;
  }
  function setupStatefulComponent(instance, isSSR) {
    const Component = instance.type;
    instance.accessCache = /* @__PURE__ */ Object.create(null);
    instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers);
    const { setup } = Component;
    if (setup) {
      pauseTracking();
      const setupContext = instance.setupContext = setup.length > 1 ? createSetupContext(instance) : null;
      const reset = setCurrentInstance(instance);
      const setupResult = callWithErrorHandling(
        setup,
        instance,
        0,
        [
          instance.props,
          setupContext
        ]
      );
      const isAsyncSetup = isPromise(setupResult);
      resetTracking();
      reset();
      if ((isAsyncSetup || instance.sp) && !isAsyncWrapper(instance)) {
        markAsyncBoundary(instance);
      }
      if (isAsyncSetup) {
        setupResult.then(unsetCurrentInstance, unsetCurrentInstance);
        if (isSSR) {
          return setupResult.then((resolvedResult) => {
            setInSSRSetupState(true);
            try {
              handleSetupResult(instance, resolvedResult, isSSR);
            } finally {
              setInSSRSetupState(false);
            }
          }).catch((e) => {
            handleError(e, instance, 0, void 0, true);
            instance.ssrRender = (_, push) => push("<!---->");
          });
        } else {
          instance.asyncDep = setupResult;
        }
      } else {
        handleSetupResult(instance, setupResult, isSSR);
      }
    } else {
      finishComponentSetup(instance, isSSR);
    }
  }
  function handleSetupResult(instance, setupResult, isSSR) {
    if (isFunction(setupResult)) {
      if (instance.type.__ssrInlineRender) {
        instance.ssrRender = setupResult;
      } else {
        instance.render = setupResult;
      }
    } else if (isObject(setupResult)) {
      instance.setupState = proxyRefs(setupResult);
    } else ;
    finishComponentSetup(instance, isSSR);
  }
  let compile$1;
  let installWithProxy;
  function registerRuntimeCompiler(_compile) {
    compile$1 = _compile;
    installWithProxy = (i) => {
      if (i.render._rc) {
        i.withProxy = new Proxy(i.ctx, RuntimeCompiledPublicInstanceProxyHandlers);
      }
    };
  }
  const isRuntimeOnly = () => !compile$1;
  function finishComponentSetup(instance, isSSR, skipOptions) {
    const Component = instance.type;
    if (!instance.render) {
      if (!isSSR && compile$1 && !Component.render) {
        const template = Component.template || resolveMergedOptions(instance).template;
        if (template) {
          const { isCustomElement, compilerOptions } = instance.appContext.config;
          const { delimiters, compilerOptions: componentCompilerOptions } = Component;
          const finalCompilerOptions = extend(
            extend(
              {
                isCustomElement,
                delimiters
              },
              compilerOptions
            ),
            componentCompilerOptions
          );
          Component.render = compile$1(template, finalCompilerOptions);
        }
      }
      instance.render = Component.render || NOOP;
      if (installWithProxy) {
        installWithProxy(instance);
      }
    }
    {
      const reset = setCurrentInstance(instance);
      pauseTracking();
      try {
        applyOptions(instance);
      } finally {
        resetTracking();
        reset();
      }
    }
  }
  const rawAttrsKey = /* @__PURE__ */ Symbol();
  const attrsProxyHandlers = {
    get(target, key) {
      track(target, "get", "");
      return key === rawAttrsKey ? target : target[key];
    }
  };
  function createSetupContext(instance) {
    const expose = (exposed) => {
      instance.exposed = exposed || {};
    };
    {
      return {
        attrs: new Proxy(instance.attrs, attrsProxyHandlers),
        slots: instance.slots,
        emit: instance.emit,
        expose
      };
    }
  }
  function getComponentPublicInstance(instance) {
    if (instance.exposed) {
      return instance.exposeProxy || (instance.exposeProxy = new Proxy(proxyRefs(markRaw(instance.exposed)), {
        get(target, key) {
          if (key in target) {
            return target[key];
          } else if (key in publicPropertiesMap) {
            return publicPropertiesMap[key](instance);
          }
        },
        has(target, key) {
          return key in target || key in publicPropertiesMap;
        }
      }));
    } else {
      return instance.proxy;
    }
  }
  const classifyRE = /(?:^|[-_])\w/g;
  const classify = (str) => str.replace(classifyRE, (c) => c.toUpperCase()).replace(/[-_]/g, "");
  function getComponentName(Component, includeInferred = true) {
    return isFunction(Component) ? Component.displayName || Component.name : Component.name || includeInferred && Component.__name;
  }
  function formatComponentName(instance, Component, isRoot = false) {
    let name = getComponentName(Component);
    if (!name && Component.__file) {
      const match = Component.__file.match(/([^/\\]+)\.\w+$/);
      if (match) {
        name = match[1];
      }
    }
    if (!name && instance) {
      const inferFromRegistry = (registry) => {
        for (const key in registry) {
          if (registry[key] === Component) {
            return key;
          }
        }
      };
      name = inferFromRegistry(instance.components) || instance.parent && inferFromRegistry(
        instance.parent.type.components
      ) || inferFromRegistry(instance.appContext.components);
    }
    return name ? classify(name) : isRoot ? `App` : `Anonymous`;
  }
  function isClassComponent(value) {
    return isFunction(value) && "__vccOpts" in value;
  }
  const computed$h = (getterOrOptions, debugOptions) => {
    const c = /* @__PURE__ */ computed$i(getterOrOptions, debugOptions, isInSSRComponentSetup);
    return c;
  };
  function h(type, propsOrChildren, children) {
    try {
      setBlockTracking(-1);
      const l = arguments.length;
      if (l === 2) {
        if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
          if (isVNode(propsOrChildren)) {
            return createVNode(type, null, [propsOrChildren]);
          }
          return createVNode(type, propsOrChildren);
        } else {
          return createVNode(type, null, propsOrChildren);
        }
      } else {
        if (l > 3) {
          children = Array.prototype.slice.call(arguments, 2);
        } else if (l === 3 && isVNode(children)) {
          children = [children];
        }
        return createVNode(type, propsOrChildren, children);
      }
    } finally {
      setBlockTracking(1);
    }
  }
  function initCustomFormatter() {
    {
      return;
    }
  }
  function withMemo(memo, render2, cache, index) {
    const cached = cache[index];
    if (cached && isMemoSame(cached, memo)) {
      return cached;
    }
    const ret = render2();
    ret.memo = memo.slice();
    ret.cacheIndex = index;
    return cache[index] = ret;
  }
  function isMemoSame(cached, memo) {
    const prev = cached.memo;
    if (prev.length != memo.length) {
      return false;
    }
    for (let i = 0; i < prev.length; i++) {
      if (hasChanged(prev[i], memo[i])) {
        return false;
      }
    }
    if (isBlockTreeEnabled > 0 && currentBlock) {
      currentBlock.push(cached);
    }
    return true;
  }
  const version = "3.5.45";
  const warn = NOOP;
  const ErrorTypeStrings = ErrorTypeStrings$1;
  const devtools = devtools$1;
  const setDevtoolsHook = setDevtoolsHook$1;
  const _ssrUtils = {
    createComponentInstance,
    setupComponent,
    renderComponentRoot,
    setCurrentRenderingInstance,
    isVNode,
    normalizeVNode,
    getComponentPublicInstance,
    ensureValidVNode,
    pushWarningContext,
    popWarningContext
  };
  const ssrUtils = _ssrUtils;
  const resolveFilter = null;
  const compatUtils = null;
  const DeprecationTypes = null;
  /**
  * @vue/runtime-dom v3.5.45
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  let policy = void 0;
  const tt = typeof window !== "undefined" && window.trustedTypes;
  if (tt) {
    try {
      policy = /* @__PURE__ */ tt.createPolicy("vue", {
        createHTML: (val) => val
      });
    } catch (e) {
    }
  }
  const unsafeToTrustedHTML = policy ? (val) => policy.createHTML(val) : (val) => val;
  const svgNS = "http://www.w3.org/2000/svg";
  const mathmlNS = "http://www.w3.org/1998/Math/MathML";
  const doc = typeof document !== "undefined" ? document : null;
  const templateContainer = doc && /* @__PURE__ */ doc.createElement("template");
  const nodeOps = {
    insert: (child, parent, anchor) => {
      parent.insertBefore(child, anchor || null);
    },
    remove: (child) => {
      const parent = child.parentNode;
      if (parent) {
        parent.removeChild(child);
      }
    },
    createElement: (tag, namespace, is, props) => {
      const el = namespace === "svg" ? doc.createElementNS(svgNS, tag) : namespace === "mathml" ? doc.createElementNS(mathmlNS, tag) : is ? doc.createElement(tag, { is }) : doc.createElement(tag);
      if (tag === "select" && props && props.multiple != null) {
        el.setAttribute("multiple", props.multiple);
      }
      return el;
    },
    createText: (text) => doc.createTextNode(text),
    createComment: (text) => doc.createComment(text),
    setText: (node, text) => {
      node.nodeValue = text;
    },
    setElementText: (el, text) => {
      el.textContent = text;
    },
    parentNode: (node) => node.parentNode,
    nextSibling: (node) => node.nextSibling,
    querySelector: (selector) => doc.querySelector(selector),
    setScopeId(el, id) {
      el.setAttribute(id, "");
    },
    // __UNSAFE__
    // Reason: innerHTML.
    // Static content here can only come from compiled templates.
    // As long as the user only uses trusted templates, this is safe.
    insertStaticContent(content, parent, anchor, namespace, start, end) {
      const before = anchor ? anchor.previousSibling : parent.lastChild;
      if (start && (start === end || start.nextSibling)) {
        while (true) {
          parent.insertBefore(start.cloneNode(true), anchor);
          if (start === end || !(start = start.nextSibling)) break;
        }
      } else {
        templateContainer.innerHTML = unsafeToTrustedHTML(
          namespace === "svg" ? `<svg>${content}</svg>` : namespace === "mathml" ? `<math>${content}</math>` : content
        );
        const template = templateContainer.content;
        if (namespace === "svg" || namespace === "mathml") {
          const wrapper = template.firstChild;
          while (wrapper.firstChild) {
            template.appendChild(wrapper.firstChild);
          }
          template.removeChild(wrapper);
        }
        parent.insertBefore(template, anchor);
      }
      return [
        // first
        before ? before.nextSibling : parent.firstChild,
        // last
        anchor ? anchor.previousSibling : parent.lastChild
      ];
    }
  };
  const TRANSITION = "transition";
  const ANIMATION = "animation";
  const vtcKey = /* @__PURE__ */ Symbol("_vtc");
  const DOMTransitionPropsValidators = {
    name: String,
    type: String,
    css: {
      type: Boolean,
      default: true
    },
    duration: [String, Number, Object],
    enterFromClass: String,
    enterActiveClass: String,
    enterToClass: String,
    appearFromClass: String,
    appearActiveClass: String,
    appearToClass: String,
    leaveFromClass: String,
    leaveActiveClass: String,
    leaveToClass: String
  };
  const TransitionPropsValidators = /* @__PURE__ */ extend(
    {},
    BaseTransitionPropsValidators,
    DOMTransitionPropsValidators
  );
  const decorate$1 = (t2) => {
    t2.displayName = "Transition";
    t2.props = TransitionPropsValidators;
    return t2;
  };
  const Transition = /* @__PURE__ */ decorate$1(
    (props, { slots }) => h(BaseTransition, resolveTransitionProps(props), slots)
  );
  const callHook = (hook, args = []) => {
    if (isArray(hook)) {
      hook.forEach((h2) => h2(...args));
    } else if (hook) {
      hook(...args);
    }
  };
  const hasExplicitCallback = (hook) => {
    return hook ? isArray(hook) ? hook.some((h2) => h2.length > 1) : hook.length > 1 : false;
  };
  function resolveTransitionProps(rawProps) {
    const baseProps = {};
    for (const key in rawProps) {
      if (!(key in DOMTransitionPropsValidators)) {
        baseProps[key] = rawProps[key];
      }
    }
    if (rawProps.css === false) {
      return baseProps;
    }
    const {
      name = "v",
      type,
      duration,
      enterFromClass = `${name}-enter-from`,
      enterActiveClass = `${name}-enter-active`,
      enterToClass = `${name}-enter-to`,
      appearFromClass = enterFromClass,
      appearActiveClass = enterActiveClass,
      appearToClass = enterToClass,
      leaveFromClass = `${name}-leave-from`,
      leaveActiveClass = `${name}-leave-active`,
      leaveToClass = `${name}-leave-to`
    } = rawProps;
    const durations = normalizeDuration(duration);
    const enterDuration = durations && durations[0];
    const leaveDuration = durations && durations[1];
    const {
      onBeforeEnter,
      onEnter,
      onEnterCancelled,
      onLeave,
      onLeaveCancelled,
      onBeforeAppear = onBeforeEnter,
      onAppear = onEnter,
      onAppearCancelled = onEnterCancelled
    } = baseProps;
    const finishEnter = (el, isAppear, done, isCancelled) => {
      el._enterCancelled = isCancelled;
      removeTransitionClass(el, isAppear ? appearToClass : enterToClass);
      removeTransitionClass(el, isAppear ? appearActiveClass : enterActiveClass);
      done && done();
    };
    const finishLeave = (el, done) => {
      el._isLeaving = false;
      removeTransitionClass(el, leaveFromClass);
      removeTransitionClass(el, leaveToClass);
      removeTransitionClass(el, leaveActiveClass);
      done && done();
    };
    const makeEnterHook = (isAppear) => {
      return (el, done) => {
        const hook = isAppear ? onAppear : onEnter;
        const resolve2 = () => finishEnter(el, isAppear, done);
        callHook(hook, [el, resolve2]);
        nextFrame(() => {
          removeTransitionClass(el, isAppear ? appearFromClass : enterFromClass);
          addTransitionClass(el, isAppear ? appearToClass : enterToClass);
          if (!hasExplicitCallback(hook)) {
            whenTransitionEnds(el, type, enterDuration, resolve2);
          }
        });
      };
    };
    return extend(baseProps, {
      onBeforeEnter(el) {
        callHook(onBeforeEnter, [el]);
        addTransitionClass(el, enterFromClass);
        addTransitionClass(el, enterActiveClass);
      },
      onBeforeAppear(el) {
        callHook(onBeforeAppear, [el]);
        addTransitionClass(el, appearFromClass);
        addTransitionClass(el, appearActiveClass);
      },
      onEnter: makeEnterHook(false),
      onAppear: makeEnterHook(true),
      onLeave(el, done) {
        el._isLeaving = true;
        const resolve2 = () => finishLeave(el, done);
        addTransitionClass(el, leaveFromClass);
        if (!el._enterCancelled) {
          forceReflow(el);
          addTransitionClass(el, leaveActiveClass);
        } else {
          addTransitionClass(el, leaveActiveClass);
          forceReflow(el);
        }
        nextFrame(() => {
          if (!el._isLeaving) {
            return;
          }
          removeTransitionClass(el, leaveFromClass);
          addTransitionClass(el, leaveToClass);
          if (!hasExplicitCallback(onLeave)) {
            whenTransitionEnds(el, type, leaveDuration, resolve2);
          }
        });
        callHook(onLeave, [el, resolve2]);
      },
      onEnterCancelled(el) {
        finishEnter(el, false, void 0, true);
        callHook(onEnterCancelled, [el]);
      },
      onAppearCancelled(el) {
        finishEnter(el, true, void 0, true);
        callHook(onAppearCancelled, [el]);
      },
      onLeaveCancelled(el) {
        finishLeave(el);
        callHook(onLeaveCancelled, [el]);
      }
    });
  }
  function normalizeDuration(duration) {
    if (duration == null) {
      return null;
    } else if (isObject(duration)) {
      return [NumberOf(duration.enter), NumberOf(duration.leave)];
    } else {
      const n = NumberOf(duration);
      return [n, n];
    }
  }
  function NumberOf(val) {
    const res = toNumber(val);
    return res;
  }
  function addTransitionClass(el, cls) {
    cls.split(/\s+/).forEach((c) => c && el.classList.add(c));
    (el[vtcKey] || (el[vtcKey] = /* @__PURE__ */ new Set())).add(cls);
  }
  function removeTransitionClass(el, cls) {
    cls.split(/\s+/).forEach((c) => c && el.classList.remove(c));
    const _vtc = el[vtcKey];
    if (_vtc) {
      _vtc.delete(cls);
      if (!_vtc.size) {
        el[vtcKey] = void 0;
      }
    }
  }
  function nextFrame(cb) {
    requestAnimationFrame(() => {
      requestAnimationFrame(cb);
    });
  }
  let endId = 0;
  function whenTransitionEnds(el, expectedType, explicitTimeout, resolve2) {
    const id = el._endId = ++endId;
    const resolveIfNotStale = () => {
      if (id === el._endId) {
        resolve2();
      }
    };
    if (explicitTimeout != null) {
      return setTimeout(resolveIfNotStale, explicitTimeout);
    }
    const { type, timeout, propCount } = getTransitionInfo(el, expectedType);
    if (!type) {
      return resolve2();
    }
    const endEvent = type + "end";
    let ended = 0;
    const end = () => {
      el.removeEventListener(endEvent, onEnd);
      resolveIfNotStale();
    };
    const onEnd = (e) => {
      if (e.target === el && ++ended >= propCount) {
        end();
      }
    };
    setTimeout(() => {
      if (ended < propCount) {
        end();
      }
    }, timeout + 1);
    el.addEventListener(endEvent, onEnd);
  }
  function getTransitionInfo(el, expectedType) {
    const styles = window.getComputedStyle(el);
    const getStyleProperties = (key) => (styles[key] || "").split(", ");
    const transitionDelays = getStyleProperties(`${TRANSITION}Delay`);
    const transitionDurations = getStyleProperties(`${TRANSITION}Duration`);
    const transitionTimeout = getTimeout(transitionDelays, transitionDurations);
    const animationDelays = getStyleProperties(`${ANIMATION}Delay`);
    const animationDurations = getStyleProperties(`${ANIMATION}Duration`);
    const animationTimeout = getTimeout(animationDelays, animationDurations);
    let type = null;
    let timeout = 0;
    let propCount = 0;
    if (expectedType === TRANSITION) {
      if (transitionTimeout > 0) {
        type = TRANSITION;
        timeout = transitionTimeout;
        propCount = transitionDurations.length;
      }
    } else if (expectedType === ANIMATION) {
      if (animationTimeout > 0) {
        type = ANIMATION;
        timeout = animationTimeout;
        propCount = animationDurations.length;
      }
    } else {
      timeout = Math.max(transitionTimeout, animationTimeout);
      type = timeout > 0 ? transitionTimeout > animationTimeout ? TRANSITION : ANIMATION : null;
      propCount = type ? type === TRANSITION ? transitionDurations.length : animationDurations.length : 0;
    }
    const hasTransform = type === TRANSITION && /\b(?:transform|all)(?:,|$)/.test(
      getStyleProperties(`${TRANSITION}Property`).toString()
    );
    return {
      type,
      timeout,
      propCount,
      hasTransform
    };
  }
  function getTimeout(delays, durations) {
    while (delays.length < durations.length) {
      delays = delays.concat(delays);
    }
    return Math.max(...durations.map((d, i) => toMs(d) + toMs(delays[i])));
  }
  function toMs(s) {
    if (s === "auto") return 0;
    return Number(s.slice(0, -1).replace(",", ".")) * 1e3;
  }
  function forceReflow(el) {
    const targetDocument = el ? el.ownerDocument : document;
    return targetDocument.body.offsetHeight;
  }
  function patchClass(el, value, isSVG) {
    const transitionClasses = el[vtcKey];
    if (transitionClasses) {
      value = (value ? [value, ...transitionClasses] : [...transitionClasses]).join(" ");
    }
    if (value == null) {
      el.removeAttribute("class");
    } else if (isSVG) {
      el.setAttribute("class", value);
    } else {
      el.className = value;
    }
  }
  const vShowOriginalDisplay = /* @__PURE__ */ Symbol("_vod");
  const vShowHidden = /* @__PURE__ */ Symbol("_vsh");
  const vShow = {
    // used for prop mismatch check during hydration
    name: "show",
    beforeMount(el, { value }, { transition }) {
      el[vShowOriginalDisplay] = el.style.display === "none" ? "" : el.style.display;
      if (transition && value) {
        transition.beforeEnter(el);
      } else {
        setDisplay(el, value);
      }
    },
    mounted(el, { value }, { transition }) {
      if (transition && value) {
        transition.enter(el);
      }
    },
    updated(el, { value, oldValue }, { transition }) {
      if (!value === !oldValue) return;
      if (transition) {
        if (value) {
          transition.beforeEnter(el);
          setDisplay(el, true);
          transition.enter(el);
        } else {
          transition.leave(el, () => {
            setDisplay(el, false);
          });
        }
      } else {
        setDisplay(el, value);
      }
    },
    beforeUnmount(el, { value }) {
      setDisplay(el, value);
    }
  };
  function setDisplay(el, value) {
    el.style.display = value ? el[vShowOriginalDisplay] : "none";
    el[vShowHidden] = !value;
  }
  function initVShowForSSR() {
    vShow.getSSRProps = ({ value }) => {
      if (!value) {
        return { style: { display: "none" } };
      }
    };
  }
  const CSS_VAR_TEXT = /* @__PURE__ */ Symbol("");
  function useCssVars(getter) {
    const instance = getCurrentInstance();
    if (!instance) {
      return;
    }
    const updateTeleports = instance.ut = (vars = getter(instance.proxy)) => {
      Array.from(
        document.querySelectorAll(`[data-v-owner="${instance.uid}"]`)
      ).forEach((node) => setVarsOnNode(node, vars));
    };
    const setVars = () => {
      const vars = getter(instance.proxy);
      if (instance.ce) {
        setVarsOnNode(instance.ce, vars);
      } else {
        setVarsOnVNode(instance.subTree, vars);
      }
      updateTeleports(vars);
    };
    onBeforeUpdate(() => {
      queuePostFlushCb(setVars);
    });
    onMounted$d(() => {
      watch$e(setVars, NOOP, { flush: "post" });
      const ob = new MutationObserver(setVars);
      ob.observe(instance.subTree.el.parentNode, { childList: true });
      onUnmounted$9(() => ob.disconnect());
    });
  }
  function setVarsOnVNode(vnode, vars) {
    if (vnode.shapeFlag & 128) {
      const suspense = vnode.suspense;
      vnode = suspense.activeBranch;
      if (suspense.pendingBranch && !suspense.isHydrating) {
        suspense.effects.push(() => {
          setVarsOnVNode(suspense.activeBranch, vars);
        });
      }
    }
    while (vnode.component) {
      vnode = vnode.component.subTree;
    }
    if (vnode.shapeFlag & 1 && vnode.el) {
      setVarsOnNode(vnode.el, vars);
    } else if (vnode.type === Fragment) {
      vnode.children.forEach((c) => setVarsOnVNode(c, vars));
    } else if (vnode.type === Static) {
      let { el, anchor } = vnode;
      while (el) {
        setVarsOnNode(el, vars);
        if (el === anchor) break;
        el = el.nextSibling;
      }
    }
  }
  function setVarsOnNode(el, vars) {
    if (el.nodeType === 1) {
      const style = el.style;
      let cssText = "";
      for (const key in vars) {
        const value = normalizeCssVarValue(vars[key]);
        style.setProperty(`--${key}`, value);
        cssText += `--${key}: ${value};`;
      }
      style[CSS_VAR_TEXT] = cssText;
    }
  }
  const displayRE = /(?:^|;)\s*display\s*:/;
  function patchStyle(el, prev, next) {
    const style = el.style;
    const isCssString = isString(next);
    let hasControlledDisplay = false;
    if (next && !isCssString) {
      if (prev) {
        if (!isString(prev)) {
          for (const key in prev) {
            if (next[key] == null) {
              setStyle(style, key, "");
            }
          }
        } else {
          for (const prevStyle of prev.split(";")) {
            const key = prevStyle.slice(0, prevStyle.indexOf(":")).trim();
            if (next[key] == null) {
              setStyle(style, key, "");
            }
          }
        }
      }
      for (const key in next) {
        if (key === "display") {
          hasControlledDisplay = true;
        }
        const value = next[key];
        if (value != null) {
          if (!shouldPreserveTextareaResizeStyle(
            el,
            key,
            !isString(prev) && prev ? prev[key] : void 0,
            value
          )) {
            setStyle(style, key, value);
          }
        } else {
          setStyle(style, key, "");
        }
      }
    } else {
      if (isCssString) {
        if (prev !== next) {
          const cssVarText = style[CSS_VAR_TEXT];
          if (cssVarText) {
            next += ";" + cssVarText;
          }
          style.cssText = next;
          hasControlledDisplay = displayRE.test(next);
        }
      } else if (prev) {
        el.removeAttribute("style");
      }
    }
    if (vShowOriginalDisplay in el) {
      if (!isCssString || prev !== next) {
        el[vShowOriginalDisplay] = hasControlledDisplay ? style.display : "";
      }
      if (el[vShowHidden]) {
        style.display = "none";
      }
    }
  }
  const importantRE = /\s*!important$/;
  function setStyle(style, name, val) {
    if (isArray(val)) {
      val.forEach((v) => setStyle(style, name, v));
    } else {
      if (val == null) val = "";
      if (name.startsWith("--")) {
        if (importantRE.test(val)) {
          style.setProperty(name, val.replace(importantRE, ""), "important");
        } else {
          style.setProperty(name, val);
        }
      } else {
        const prefixed = autoPrefix(style, name);
        if (importantRE.test(val)) {
          style.setProperty(
            hyphenate(prefixed),
            val.replace(importantRE, ""),
            "important"
          );
        } else {
          style[prefixed] = val;
        }
      }
    }
  }
  const prefixes = ["Webkit", "Moz", "ms"];
  const prefixCache = {};
  function autoPrefix(style, rawName) {
    const cached = prefixCache[rawName];
    if (cached) {
      return cached;
    }
    let name = camelize(rawName);
    if (name !== "filter" && name in style) {
      return prefixCache[rawName] = name;
    }
    name = capitalize(name);
    for (let i = 0; i < prefixes.length; i++) {
      const prefixed = prefixes[i] + name;
      if (prefixed in style) {
        return prefixCache[rawName] = prefixed;
      }
    }
    return rawName;
  }
  function shouldPreserveTextareaResizeStyle(el, key, prev, next) {
    return el.tagName === "TEXTAREA" && (key === "width" || key === "height") && isString(next) && prev === next;
  }
  const xlinkNS = "http://www.w3.org/1999/xlink";
  function patchAttr(el, key, value, isSVG, instance, isBoolean = isSpecialBooleanAttr(key)) {
    if (isSVG && key.startsWith("xlink:")) {
      if (value == null) {
        el.removeAttributeNS(xlinkNS, key.slice(6, key.length));
      } else {
        el.setAttributeNS(xlinkNS, key, value);
      }
    } else {
      if (value == null || isBoolean && !includeBooleanAttr(value)) {
        el.removeAttribute(key);
      } else {
        el.setAttribute(
          key,
          isBoolean ? "" : isSymbol(value) ? String(value) : value
        );
      }
    }
  }
  function patchDOMProp(el, key, value, parentComponent, attrName) {
    if (key === "innerHTML" || key === "textContent") {
      if (value != null) {
        el[key] = key === "innerHTML" ? unsafeToTrustedHTML(value) : value;
      }
      return;
    }
    const tag = el.tagName;
    if (key === "value" && tag !== "PROGRESS" && // custom elements may use _value internally
    !tag.includes("-")) {
      const oldValue = tag === "OPTION" ? el.getAttribute("value") || "" : el.value;
      const newValue = value == null ? (
        // #11647: value should be set as empty string for null and undefined,
        // but <input type="checkbox"> should be set as 'on'.
        el.type === "checkbox" ? "on" : ""
      ) : String(value);
      if (oldValue !== newValue || !("_value" in el)) {
        el.value = newValue;
      }
      if (value == null) {
        el.removeAttribute(key);
      }
      el._value = value;
      return;
    }
    let needRemove = false;
    if (value === "" || value == null) {
      const type = typeof el[key];
      if (type === "boolean") {
        value = includeBooleanAttr(value);
      } else if (value == null && type === "string") {
        value = "";
        needRemove = true;
      } else if (type === "number") {
        value = 0;
        needRemove = true;
      }
    }
    try {
      el[key] = value;
    } catch (e) {
    }
    needRemove && el.removeAttribute(attrName || key);
  }
  function addEventListener(el, event, handler, options) {
    el.addEventListener(event, handler, options);
  }
  function removeEventListener(el, event, handler, options) {
    el.removeEventListener(event, handler, options);
  }
  const veiKey = /* @__PURE__ */ Symbol("_vei");
  function patchEvent(el, rawName, prevValue, nextValue, instance = null) {
    const invokers = el[veiKey] || (el[veiKey] = {});
    const existingInvoker = invokers[rawName];
    if (nextValue && existingInvoker) {
      existingInvoker.value = nextValue;
    } else {
      const [name, options] = parseName(rawName);
      if (nextValue) {
        const invoker = invokers[rawName] = createInvoker(
          nextValue,
          instance
        );
        addEventListener(el, name, invoker, options);
      } else if (existingInvoker) {
        removeEventListener(el, name, existingInvoker, options);
        invokers[rawName] = void 0;
      }
    }
  }
  const optionsModifierRE = /(Once|Passive|Capture)$/;
  const optionsModifierEventRE = /^on:?(?:Once|Passive|Capture)$/;
  function parseName(name) {
    let options;
    let m;
    while ((m = name.match(optionsModifierRE)) && !optionsModifierEventRE.test(name)) {
      if (!options) options = {};
      name = name.slice(0, name.length - m[1].length);
      options[m[1].toLowerCase()] = true;
    }
    const event = name[2] === ":" ? name.slice(3) : hyphenate(name.slice(2));
    return [event, options];
  }
  let cachedNow = 0;
  const p = /* @__PURE__ */ Promise.resolve();
  const getNow = () => cachedNow || (p.then(() => cachedNow = 0), cachedNow = Date.now());
  function createInvoker(initialValue, instance) {
    const invoker = (e) => {
      if (!e._vts) {
        e._vts = Date.now();
      } else if (e._vts <= invoker.attached) {
        return;
      }
      const value = invoker.value;
      if (isArray(value)) {
        const originalStop = e.stopImmediatePropagation;
        e.stopImmediatePropagation = () => {
          originalStop.call(e);
          e._stopped = true;
        };
        const handlers = value.slice();
        const args = [e];
        for (let i = 0; i < handlers.length; i++) {
          if (e._stopped) {
            break;
          }
          const handler = handlers[i];
          if (handler) {
            callWithAsyncErrorHandling(
              handler,
              instance,
              5,
              args
            );
          }
        }
      } else {
        callWithAsyncErrorHandling(
          value,
          instance,
          5,
          [e]
        );
      }
    };
    invoker.value = initialValue;
    invoker.attached = getNow();
    return invoker;
  }
  const isNativeOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && // lowercase letter
  key.charCodeAt(2) > 96 && key.charCodeAt(2) < 123;
  const patchProp = (el, key, prevValue, nextValue, namespace, parentComponent) => {
    const isSVG = namespace === "svg";
    if (key === "class") {
      patchClass(el, nextValue, isSVG);
    } else if (key === "style") {
      patchStyle(el, prevValue, nextValue);
    } else if (isOn(key)) {
      if (!isModelListener(key)) {
        patchEvent(el, key, prevValue, nextValue, parentComponent);
      }
    } else if (key[0] === "." ? (key = key.slice(1), true) : key[0] === "^" ? (key = key.slice(1), false) : shouldSetAsProp(el, key, nextValue, isSVG)) {
      patchDOMProp(el, key, nextValue);
      if (!el.tagName.includes("-") && (key === "value" || key === "checked" || key === "selected")) {
        patchAttr(el, key, nextValue, isSVG, parentComponent, key !== "value");
      }
    } else if (
      // #11081 force set props for possible async custom element
      el._isVueCE && // #12408 check if it's declared prop or it's async custom element
      (shouldSetAsPropForVueCE(el, key) || // @ts-expect-error _def is private
      el._def.__asyncLoader && (/[A-Z]/.test(key) || !isString(nextValue)))
    ) {
      patchDOMProp(el, camelize(key), nextValue, parentComponent, key);
    } else {
      if (key === "true-value") {
        el._trueValue = nextValue;
      } else if (key === "false-value") {
        el._falseValue = nextValue;
      }
      patchAttr(el, key, nextValue, isSVG);
    }
  };
  function shouldSetAsProp(el, key, value, isSVG) {
    if (isSVG) {
      if (key === "innerHTML" || key === "textContent") {
        return true;
      }
      if (key in el && isNativeOn(key) && isFunction(value)) {
        return true;
      }
      return false;
    }
    if (key === "spellcheck" || key === "draggable" || key === "translate" || key === "autocorrect") {
      return false;
    }
    if (key === "sandbox" && el.tagName === "IFRAME") {
      return false;
    }
    if (key === "form") {
      return false;
    }
    if (key === "list" && el.tagName === "INPUT") {
      return false;
    }
    if (key === "type" && el.tagName === "TEXTAREA") {
      return false;
    }
    if (key === "width" || key === "height") {
      const tag = el.tagName;
      if (tag === "IMG" || tag === "VIDEO" || tag === "CANVAS" || tag === "SOURCE") {
        return false;
      }
    }
    if (isNativeOn(key) && isString(value)) {
      return false;
    }
    return key in el;
  }
  function shouldSetAsPropForVueCE(el, key) {
    const props = (
      // @ts-expect-error _def is private
      el._def.props
    );
    if (!props) {
      return false;
    }
    const camelKey = camelize(key);
    return Array.isArray(props) ? props.some((prop) => camelize(prop) === camelKey) : Object.keys(props).some((prop) => camelize(prop) === camelKey);
  }
  const REMOVAL = {};
  // @__NO_SIDE_EFFECTS__
  function defineCustomElement(options, extraOptions, _createApp) {
    let Comp = /* @__PURE__ */ defineComponent(options, extraOptions);
    if (isPlainObject(Comp)) Comp = extend({}, Comp, extraOptions);
    class VueCustomElement extends VueElement {
      constructor(initialProps) {
        super(Comp, initialProps, _createApp);
      }
    }
    VueCustomElement.def = Comp;
    return VueCustomElement;
  }
  const defineSSRCustomElement = (/* @__NO_SIDE_EFFECTS__ */ (options, extraOptions) => {
    return /* @__PURE__ */ defineCustomElement(options, extraOptions, createSSRApp);
  });
  const BaseClass = typeof HTMLElement !== "undefined" ? HTMLElement : class {
  };
  class VueElement extends BaseClass {
    constructor(_def, _props = {}, _createApp = createApp) {
      super();
      this._def = _def;
      this._props = _props;
      this._createApp = _createApp;
      this._isVueCE = true;
      this._instance = null;
      this._app = null;
      this._nonce = this._def.nonce;
      this._connected = false;
      this._resolved = false;
      this._patching = false;
      this._dirty = false;
      this._numberProps = null;
      this._styleChildren = /* @__PURE__ */ new WeakSet();
      this._styleAnchors = /* @__PURE__ */ new WeakMap();
      this._ob = null;
      if (this.shadowRoot && _createApp !== createApp) {
        this._root = this.shadowRoot;
      } else {
        if (_def.shadowRoot !== false) {
          this.attachShadow(
            extend({}, _def.shadowRootOptions, {
              mode: "open"
            })
          );
          this._root = this.shadowRoot;
        } else {
          this._root = this;
        }
      }
    }
    connectedCallback() {
      if (!this.isConnected) return;
      if (!this.shadowRoot && !this._resolved) {
        this._parseSlots();
      }
      this._connected = true;
      let parent = this;
      while (parent = parent && // #12479 should check assignedSlot first to get correct parent
      (parent.assignedSlot || parent.parentNode || parent.host)) {
        if (parent instanceof VueElement) {
          this._parent = parent;
          break;
        }
      }
      if (!this._instance) {
        if (this._resolved) {
          this._mount(this._def);
        } else {
          if (parent && parent._pendingResolve) {
            this._pendingResolve = parent._pendingResolve.then(() => {
              this._pendingResolve = void 0;
              if (this.isConnected) {
                return this._resolveDef();
              }
            });
          } else {
            this._resolveDef();
          }
        }
      }
    }
    _setParent(parent = this._parent) {
      if (parent) {
        this._instance.parent = parent._instance;
        this._inheritParentContext(parent);
      }
    }
    _inheritParentContext(parent = this._parent) {
      if (parent && this._app) {
        Object.setPrototypeOf(
          this._app._context.provides,
          parent._instance.provides
        );
      }
    }
    disconnectedCallback() {
      this._connected = false;
      nextTick$2(() => {
        if (!this._connected) {
          if (this._ob) {
            this._ob.disconnect();
            this._ob = null;
          }
          this._app && this._app.unmount();
          if (this._instance) this._instance.ce = void 0;
          this._app = this._instance = null;
          if (this._teleportTargets) {
            this._teleportTargets.clear();
            this._teleportTargets = void 0;
          }
        }
      });
    }
    _processMutations(mutations) {
      for (const m of mutations) {
        this._setAttr(m.attributeName);
      }
    }
    /**
     * resolve inner component definition (handle possible async component)
     */
    _resolveDef() {
      if (this._pendingResolve) {
        return this._pendingResolve;
      }
      for (let i = 0; i < this.attributes.length; i++) {
        this._setAttr(this.attributes[i].name);
      }
      this._ob = new MutationObserver(this._processMutations.bind(this));
      this._ob.observe(this, { attributes: true });
      const resolve2 = (def2, isAsync = false) => {
        this._resolved = true;
        this._pendingResolve = void 0;
        const { props, styles } = def2;
        let numberProps;
        if (props && !isArray(props)) {
          for (const key in props) {
            const opt = props[key];
            if (opt === Number || opt && opt.type === Number) {
              if (key in this._props) {
                this._props[key] = toNumber(this._props[key]);
              }
              (numberProps || (numberProps = /* @__PURE__ */ Object.create(null)))[camelize(key)] = true;
            }
          }
        }
        this._numberProps = numberProps;
        this._resolveProps(def2);
        if (this.shadowRoot) {
          this._applyStyles(styles);
        }
        if (this._connected) {
          this._mount(def2);
        }
      };
      const asyncDef = this._def.__asyncLoader;
      if (asyncDef) {
        this._pendingResolve = asyncDef().then((def2) => {
          def2.configureApp = this._def.configureApp;
          resolve2(this._def = def2, true);
        });
        return this._pendingResolve;
      } else {
        resolve2(this._def);
      }
    }
    _mount(def2) {
      this._app = this._createApp(def2);
      this._inheritParentContext();
      if (def2.configureApp) {
        def2.configureApp(this._app);
      }
      this._app._ceVNode = this._createVNode();
      this._app.mount(this._root);
      const exposed = this._instance && this._instance.exposed;
      if (!exposed) return;
      for (const key in exposed) {
        if (!hasOwn(this, key)) {
          Object.defineProperty(this, key, {
            // unwrap ref to be consistent with public instance behavior
            get: () => unref(exposed[key])
          });
        }
      }
    }
    _resolveProps(def2) {
      const { props } = def2;
      const declaredPropKeys = isArray(props) ? props : Object.keys(props || {});
      for (const key of Object.keys(this)) {
        if (key[0] !== "_" && declaredPropKeys.includes(key)) {
          this._setProp(key, this[key]);
        }
      }
      for (const key of declaredPropKeys.map(camelize)) {
        Object.defineProperty(this, key, {
          get() {
            return this._getProp(key);
          },
          set(val) {
            this._setProp(key, val, true, !this._patching);
          }
        });
      }
    }
    _setAttr(key) {
      if (key.startsWith("data-v-")) return;
      const has = this.hasAttribute(key);
      let value = has ? this.getAttribute(key) : REMOVAL;
      const camelKey = camelize(key);
      if (has && this._numberProps && this._numberProps[camelKey]) {
        value = toNumber(value);
      }
      this._setProp(camelKey, value, false, true);
    }
    /**
     * @internal
     */
    _getProp(key) {
      return this._props[key];
    }
    /**
     * @internal
     */
    _setProp(key, val, shouldReflect = true, shouldUpdate = false) {
      if (val !== this._props[key]) {
        this._dirty = true;
        if (val === REMOVAL) {
          delete this._props[key];
        } else {
          this._props[key] = val;
          if (key === "key" && this._app) {
            this._app._ceVNode.key = val;
          }
        }
        if (shouldUpdate && this._instance) {
          this._update();
        }
        if (shouldReflect) {
          const ob = this._ob;
          if (ob) {
            this._processMutations(ob.takeRecords());
            ob.disconnect();
          }
          if (val === true) {
            this.setAttribute(hyphenate(key), "");
          } else if (typeof val === "string" || typeof val === "number") {
            this.setAttribute(hyphenate(key), val + "");
          } else if (!val) {
            this.removeAttribute(hyphenate(key));
          }
          ob && ob.observe(this, { attributes: true });
        }
      }
    }
    _update() {
      const vnode = this._createVNode();
      if (this._app) vnode.appContext = this._app._context;
      render(vnode, this._root);
    }
    _createVNode() {
      const baseProps = {};
      if (!this.shadowRoot) {
        baseProps.onVnodeMounted = baseProps.onVnodeUpdated = this._renderSlots.bind(this);
      }
      const vnode = createVNode(this._def, extend(baseProps, this._props));
      if (!this._instance) {
        vnode.ce = (instance) => {
          this._instance = instance;
          instance.ce = this;
          instance.isCE = true;
          const dispatch = (event, args) => {
            this.dispatchEvent(
              new CustomEvent(
                event,
                isPlainObject(args[0]) ? extend({ detail: args }, args[0]) : { detail: args }
              )
            );
          };
          instance.emit = (event, ...args) => {
            dispatch(event, args);
            if (hyphenate(event) !== event) {
              dispatch(hyphenate(event), args);
            }
          };
          this._setParent();
        };
      }
      return vnode;
    }
    _applyStyles(styles, owner, parentComp) {
      if (!styles) return;
      if (owner) {
        if (owner === this._def || this._styleChildren.has(owner)) {
          return;
        }
        this._styleChildren.add(owner);
      }
      const nonce = this._nonce;
      const root = this.shadowRoot;
      const insertionAnchor = parentComp ? this._getStyleAnchor(parentComp) || this._getStyleAnchor(this._def) : this._getRootStyleInsertionAnchor(root);
      let last = null;
      for (let i = styles.length - 1; i >= 0; i--) {
        const s = document.createElement("style");
        if (nonce) s.setAttribute("nonce", nonce);
        s.textContent = styles[i];
        root.insertBefore(s, last || insertionAnchor);
        last = s;
        if (i === 0) {
          if (!parentComp) this._styleAnchors.set(this._def, s);
          if (owner) this._styleAnchors.set(owner, s);
        }
      }
    }
    _getStyleAnchor(comp) {
      if (!comp) {
        return null;
      }
      const anchor = this._styleAnchors.get(comp);
      if (anchor && anchor.parentNode === this.shadowRoot) {
        return anchor;
      }
      if (anchor) {
        this._styleAnchors.delete(comp);
      }
      return null;
    }
    _getRootStyleInsertionAnchor(root) {
      for (let i = 0; i < root.childNodes.length; i++) {
        const node = root.childNodes[i];
        if (!(node instanceof HTMLStyleElement)) {
          return node;
        }
      }
      return null;
    }
    /**
     * Only called when shadowRoot is false
     */
    _parseSlots() {
      const slots = this._slots = {};
      let n;
      while (n = this.firstChild) {
        const slotName = n.nodeType === 1 && n.getAttribute("slot") || "default";
        (slots[slotName] || (slots[slotName] = [])).push(n);
        this.removeChild(n);
      }
    }
    /**
     * Only called when shadowRoot is false
     */
    _renderSlots() {
      const outlets = this._getSlots();
      const scopeId = this._instance.type.__scopeId;
      for (let i = 0; i < outlets.length; i++) {
        const o = outlets[i];
        const slotName = o.getAttribute("name") || "default";
        const content = this._slots[slotName];
        const parent = o.parentNode;
        if (content) {
          for (const n of content) {
            if (scopeId && n.nodeType === 1) {
              const id = scopeId + "-s";
              const walker = document.createTreeWalker(n, 1);
              n.setAttribute(id, "");
              let child;
              while (child = walker.nextNode()) {
                child.setAttribute(id, "");
              }
            }
            parent.insertBefore(n, o);
          }
        } else {
          while (o.firstChild) parent.insertBefore(o.firstChild, o);
        }
        parent.removeChild(o);
      }
    }
    /**
     * @internal
     */
    _getSlots() {
      const roots = [this];
      if (this._teleportTargets) {
        roots.push(...this._teleportTargets);
      }
      const slots = /* @__PURE__ */ new Set();
      for (const root of roots) {
        const found = root.querySelectorAll("slot");
        for (let i = 0; i < found.length; i++) {
          slots.add(found[i]);
        }
      }
      return Array.from(slots);
    }
    /**
     * @internal
     */
    _injectChildStyle(comp, parentComp) {
      this._applyStyles(comp.styles, comp, parentComp);
    }
    /**
     * @internal
     */
    _beginPatch() {
      this._patching = true;
      this._dirty = false;
    }
    /**
     * @internal
     */
    _endPatch() {
      this._patching = false;
      if (this._dirty && this._instance) {
        this._update();
      }
    }
    /**
     * @internal
     */
    _hasShadowRoot() {
      return this._def.shadowRoot !== false;
    }
    /**
     * @internal
     */
    _removeChildStyle(comp) {
    }
  }
  function useHost(caller) {
    const instance = getCurrentInstance();
    const el = instance && instance.ce;
    if (el) {
      return el;
    }
    return null;
  }
  function useShadowRoot() {
    const el = useHost();
    return el && el.shadowRoot;
  }
  function useCssModule(name = "$style") {
    {
      const instance = getCurrentInstance();
      if (!instance) {
        return EMPTY_OBJ;
      }
      const modules = instance.type.__cssModules;
      if (!modules) {
        return EMPTY_OBJ;
      }
      const mod = modules[name];
      if (!mod) {
        return EMPTY_OBJ;
      }
      return mod;
    }
  }
  const positionMap = /* @__PURE__ */ new WeakMap();
  const newPositionMap = /* @__PURE__ */ new WeakMap();
  const moveCbKey = /* @__PURE__ */ Symbol("_moveCb");
  const enterCbKey = /* @__PURE__ */ Symbol("_enterCb");
  const pendingGroups = /* @__PURE__ */ new WeakMap();
  const decorate = (t2) => {
    delete t2.props.mode;
    return t2;
  };
  const TransitionGroupImpl = /* @__PURE__ */ decorate({
    name: "TransitionGroup",
    props: /* @__PURE__ */ extend({}, TransitionPropsValidators, {
      tag: String,
      moveClass: String
    }),
    setup(props, { slots }) {
      const instance = getCurrentInstance();
      const state = useTransitionState();
      let prevChildren;
      let children;
      let origins;
      let moves;
      const willMove = () => {
        if (moves === void 0) {
          moves = prevChildren.length > 0 && hasCSSTransform(
            prevChildren[0].el,
            instance.vnode.el,
            resolveMoveClass(props)
          );
        }
        return moves;
      };
      onUpdated(() => {
        pendingGroups.delete(instance);
        if (!willMove()) {
          prevChildren = [];
          origins = void 0;
          return;
        }
        const moveClass = resolveMoveClass(props);
        prevChildren.forEach(callPendingCbs);
        const shift = origins && getOriginShift(origins, instance.vnode.el);
        origins = void 0;
        prevChildren.forEach((c) => recordPosition(c, shift));
        const movedChildren = prevChildren.filter(applyTranslation);
        forceReflow(instance.vnode.el);
        movedChildren.forEach((c) => {
          const el = c.el;
          const style = el.style;
          addTransitionClass(el, moveClass);
          style.transform = style.webkitTransform = style.transitionDuration = "";
          const cb = el[moveCbKey] = (e) => {
            if (e && e.target !== el) {
              return;
            }
            if (!e || e.propertyName.endsWith("transform")) {
              el.removeEventListener("transitionend", cb);
              el[moveCbKey] = null;
              removeTransitionClass(el, moveClass);
            }
          };
          el.addEventListener("transitionend", cb);
        });
        prevChildren = [];
      });
      return () => {
        const rawProps = /* @__PURE__ */ toRaw(props);
        const cssTransitionProps = resolveTransitionProps(rawProps);
        let tag = rawProps.tag || Fragment;
        prevChildren = [];
        moves = void 0;
        if (children) {
          for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.el && child.el instanceof Element && // Hidden v-show nodes have no previous layout box to animate from.
            !child.el[vShowHidden]) {
              prevChildren.push(child);
              setTransitionHooks(
                child,
                resolveTransitionHooks(
                  child,
                  cssTransitionProps,
                  state,
                  instance
                )
              );
              positionMap.set(child, getPosition(child.el));
            }
          }
        }
        children = slots.default ? getTransitionRawChildren(slots.default()) : [];
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.key != null) {
            setTransitionHooks(
              child,
              resolveTransitionHooks(child, cssTransitionProps, state, instance)
            );
          }
        }
        if (prevChildren.length) {
          origins = getOrigins(instance);
          pendingGroups.set(instance, willMove);
        }
        return createVNode(tag, null, children);
      };
    }
  });
  const TransitionGroup = TransitionGroupImpl;
  function callPendingCbs(c) {
    const el = c.el;
    if (el[moveCbKey]) {
      el[moveCbKey]();
    }
    if (el[enterCbKey]) {
      el[enterCbKey]();
    }
  }
  function resolveMoveClass(props) {
    return props.moveClass || `${props.name || "v"}-move`;
  }
  function recordPosition(c, shift) {
    newPositionMap.set(c, getPosition(c.el, shift));
  }
  function applyTranslation(c) {
    const oldPos = positionMap.get(c);
    const newPos = newPositionMap.get(c);
    const dx = oldPos.left - newPos.left;
    const dy = oldPos.top - newPos.top;
    if (dx || dy) {
      const el = c.el;
      const s = el.style;
      const rect = el.getBoundingClientRect();
      let scaleX = 1;
      let scaleY = 1;
      if (el.offsetWidth) scaleX = rect.width / el.offsetWidth;
      if (el.offsetHeight) scaleY = rect.height / el.offsetHeight;
      if (!Number.isFinite(scaleX) || scaleX === 0) scaleX = 1;
      if (!Number.isFinite(scaleY) || scaleY === 0) scaleY = 1;
      if (Math.abs(scaleX - 1) < 0.01) scaleX = 1;
      if (Math.abs(scaleY - 1) < 0.01) scaleY = 1;
      s.transform = s.webkitTransform = `translate(${dx / scaleX}px,${dy / scaleY}px)`;
      s.transitionDuration = "0s";
      return c;
    }
  }
  function getPosition(el, shift) {
    const rect = el.getBoundingClientRect();
    return {
      left: rect.left - (shift ? shift.left : 0),
      top: rect.top - (shift ? shift.top : 0)
    };
  }
  function getOrigins(instance) {
    let origins;
    for (let group = instance.parent; group; group = group.parent) {
      const willMove = pendingGroups.get(group);
      if (willMove) {
        const item = findItem(group.vnode.el, instance.vnode.el);
        if (item) {
          (origins || (origins = [])).push(
            extend(getPosition(item), { item, willMove })
          );
        }
      }
    }
    return origins;
  }
  function findItem(root, node) {
    const container = root.nodeType === 1 ? root : root.parentNode;
    while (node && node.parentNode !== container) {
      node = node.parentNode;
    }
    if (node && node.nodeType === 1) {
      return node;
    }
  }
  function getOriginShift(origins, root) {
    const origin = origins.find((o) => o.willMove() && o.item.contains(root));
    return origin && getPosition(origin.item, origin);
  }
  function hasCSSTransform(el, root, moveClass) {
    const clone = el.cloneNode();
    const _vtc = el[vtcKey];
    if (_vtc) {
      _vtc.forEach((cls) => {
        cls.split(/\s+/).forEach((c) => c && clone.classList.remove(c));
      });
    }
    moveClass.split(/\s+/).forEach((c) => c && clone.classList.add(c));
    clone.style.display = "none";
    const container = root.nodeType === 1 ? root : root.parentNode;
    container.appendChild(clone);
    const { hasTransform } = getTransitionInfo(clone);
    container.removeChild(clone);
    return hasTransform;
  }
  const getModelAssigner = (vnode) => {
    const fn = vnode.props["onUpdate:modelValue"] || false;
    return isArray(fn) ? (value) => invokeArrayFns(fn, value) : fn;
  };
  function onCompositionStart(e) {
    e.target.composing = true;
  }
  function onCompositionEnd(e) {
    const target = e.target;
    if (target.composing) {
      target.composing = false;
      target.dispatchEvent(new Event("input"));
    }
  }
  const assignKey = /* @__PURE__ */ Symbol("_assign");
  const initialValueKey = /* @__PURE__ */ Symbol("_initialValue");
  function castValue(value, trim, number) {
    if (trim) value = value.trim();
    if (number) value = looseToNumber(value);
    return value;
  }
  const vModelText = {
    created(el, { modifiers: { lazy, trim, number } }, vnode) {
      if (el.parentNode) {
        if (el.type === "text") {
          el[initialValueKey] = el.defaultValue.replace(/[\r\n]/g, "");
        } else if (el.type === "textarea") {
          el[initialValueKey] = el.defaultValue.replace(/\r\n?/g, "\n");
        }
      }
      el[assignKey] = getModelAssigner(vnode);
      const castToNumber = number || vnode.props && vnode.props.type === "number";
      addEventListener(el, lazy ? "change" : "input", (e) => {
        if (e.target.composing) return;
        el[assignKey](castValue(el.value, trim, castToNumber));
      });
      if (trim || castToNumber) {
        addEventListener(el, "change", () => {
          el.value = castValue(el.value, trim, castToNumber);
        });
      }
      if (!lazy) {
        addEventListener(el, "compositionstart", onCompositionStart);
        addEventListener(el, "compositionend", onCompositionEnd);
        addEventListener(el, "change", onCompositionEnd);
      }
    },
    // set value on mounted so it's after min/max for type="range"
    mounted(el, { value, modifiers: { trim, number } }) {
      const newValue = value == null ? "" : value;
      const initialValue = el[initialValueKey];
      delete el[initialValueKey];
      if (initialValue !== void 0 && (el.type === "text" || el.type === "textarea") && el.value !== initialValue) {
        el[assignKey](castValue(el.value, trim, number));
      } else {
        el.value = newValue;
      }
    },
    beforeUpdate(el, { value, oldValue, modifiers: { lazy, trim, number } }, vnode) {
      el[assignKey] = getModelAssigner(vnode);
      if (el.composing) return;
      const elValue = (number || el.type === "number") && !/^0\d/.test(el.value) ? looseToNumber(el.value) : el.value;
      const newValue = value == null ? "" : value;
      if (elValue === newValue) {
        return;
      }
      const rootNode = el.getRootNode();
      if ((rootNode instanceof Document || rootNode instanceof ShadowRoot) && rootNode.activeElement === el && el.type !== "range") {
        if (lazy && value === oldValue) {
          return;
        }
        if (trim && el.value.trim() === newValue) {
          return;
        }
      }
      el.value = newValue;
    }
  };
  const vModelCheckbox = {
    // #4096 array checkboxes need to be deep traversed
    deep: true,
    created(el, _, vnode) {
      el[assignKey] = getModelAssigner(vnode);
      addEventListener(el, "change", () => {
        const modelValue = el._modelValue;
        const elementValue = getValue(el);
        const checked = el.checked;
        const assign = el[assignKey];
        if (isArray(modelValue)) {
          const index = looseIndexOf(modelValue, elementValue);
          const found = index !== -1;
          if (checked && !found) {
            assign(modelValue.concat(elementValue));
          } else if (!checked && found) {
            const filtered = [...modelValue];
            filtered.splice(index, 1);
            assign(filtered);
          }
        } else if (isSet(modelValue)) {
          const cloned = new Set(modelValue);
          if (checked) {
            cloned.add(elementValue);
          } else {
            cloned.delete(elementValue);
          }
          assign(cloned);
        } else {
          assign(getCheckboxValue(el, checked));
        }
      });
    },
    // set initial checked on mount to wait for true-value/false-value
    mounted: setChecked,
    beforeUpdate(el, binding, vnode) {
      el[assignKey] = getModelAssigner(vnode);
      setChecked(el, binding, vnode);
    }
  };
  function setChecked(el, { value, oldValue }, vnode) {
    el._modelValue = value;
    let checked;
    if (isArray(value)) {
      checked = looseIndexOf(value, vnode.props.value) > -1;
    } else if (isSet(value)) {
      checked = value.has(vnode.props.value);
    } else {
      if (value === oldValue) return;
      checked = looseEqual(value, getCheckboxValue(el, true));
    }
    if (el.checked !== checked) {
      el.checked = checked;
    }
  }
  const vModelRadio = {
    created(el, { value }, vnode) {
      el.checked = looseEqual(value, vnode.props.value);
      el[assignKey] = getModelAssigner(vnode);
      addEventListener(el, "change", () => {
        el[assignKey](getValue(el));
      });
    },
    beforeUpdate(el, { value, oldValue }, vnode) {
      el[assignKey] = getModelAssigner(vnode);
      if (value !== oldValue) {
        el.checked = looseEqual(value, vnode.props.value);
      }
    }
  };
  const vModelSelect = {
    // <select multiple> value need to be deep traversed
    deep: true,
    created(el, { value, modifiers: { number } }, vnode) {
      el._modelValue = value;
      addEventListener(el, "change", () => {
        const selectedVal = Array.prototype.filter.call(el.options, (o) => o.selected).map(
          (o) => number ? looseToNumber(getValue(o)) : getValue(o)
        );
        const multiple = el.multiple;
        const assignedValue = multiple ? isSet(el._modelValue) ? new Set(selectedVal) : selectedVal : selectedVal[0];
        const pending = el._pendingValue = [
          multiple,
          multiple ? isArray(assignedValue) ? selectedVal.slice() : selectedVal : assignedValue
        ];
        try {
          el[assignKey](assignedValue);
        } finally {
          nextTick$2(() => {
            if (el._pendingValue === pending) {
              el._pendingValue = void 0;
            }
          });
        }
      });
      el[assignKey] = getModelAssigner(vnode);
    },
    // set value in mounted & updated because <select> relies on its children
    // <option>s.
    mounted(el, { value, modifiers: { number } }) {
      setSelected(el, value, number);
    },
    beforeUpdate(el, { value }, vnode) {
      el._modelValue = value;
      el[assignKey] = getModelAssigner(vnode);
    },
    updated(el, { value, modifiers: { number } }) {
      const pending = el._pendingValue;
      el._pendingValue = void 0;
      if (!pending || pending[0] !== el.multiple || !isSameSelectValue(value, pending[1], pending[0])) {
        setSelected(el, value, number);
      }
    }
  };
  function isSameSelectValue(value, assignedValue, multiple) {
    if (!multiple) return looseEqual(value, assignedValue);
    if (isArray(value)) return looseEqual(value, assignedValue);
    if (isSet(value)) {
      if (value.size !== assignedValue.length) return false;
      for (const item of assignedValue) {
        if (!value.has(item)) return false;
      }
      return true;
    }
    return false;
  }
  function setSelected(el, value, number = false) {
    const isMultiple = el.multiple;
    const isArrayValue = isArray(value);
    if (isMultiple && !isArrayValue && !isSet(value)) {
      return;
    }
    for (let i = 0, l = el.options.length; i < l; i++) {
      const option = el.options[i];
      const optionValue = getValue(option);
      if (isMultiple) {
        if (isArrayValue) {
          const optionType = typeof optionValue;
          if (optionType === "string" || optionType === "number") {
            option.selected = value.some((v) => String(v) === String(optionValue));
          } else {
            option.selected = looseIndexOf(value, optionValue) > -1;
          }
        } else {
          option.selected = value.has(optionValue) || number && typeof optionValue === "string" && value.has(looseToNumber(optionValue));
        }
      } else if (looseEqual(getValue(option), value)) {
        if (el.selectedIndex !== i) el.selectedIndex = i;
        return;
      }
    }
    if (!isMultiple && el.selectedIndex !== -1) {
      el.selectedIndex = -1;
    }
  }
  function getValue(el) {
    return "_value" in el ? el._value : el.value;
  }
  function getCheckboxValue(el, checked) {
    const key = checked ? "_trueValue" : "_falseValue";
    return key in el ? el[key] : checked;
  }
  const vModelDynamic = {
    created(el, binding, vnode) {
      callModelHook(el, binding, vnode, null, "created");
    },
    mounted(el, binding, vnode) {
      callModelHook(el, binding, vnode, null, "mounted");
    },
    beforeUpdate(el, binding, vnode, prevVNode) {
      callModelHook(el, binding, vnode, prevVNode, "beforeUpdate");
    },
    updated(el, binding, vnode, prevVNode) {
      callModelHook(el, binding, vnode, prevVNode, "updated");
    }
  };
  function resolveDynamicModel(tagName, type) {
    switch (tagName) {
      case "SELECT":
        return vModelSelect;
      case "TEXTAREA":
        return vModelText;
      default:
        switch (type) {
          case "checkbox":
            return vModelCheckbox;
          case "radio":
            return vModelRadio;
          default:
            return vModelText;
        }
    }
  }
  function callModelHook(el, binding, vnode, prevVNode, hook) {
    const modelToUse = resolveDynamicModel(
      el.tagName,
      vnode.props && vnode.props.type
    );
    const fn = modelToUse[hook];
    fn && fn(el, binding, vnode, prevVNode);
  }
  function initVModelForSSR() {
    vModelText.getSSRProps = ({ value }) => ({ value });
    vModelRadio.getSSRProps = ({ value }, vnode) => {
      if (vnode.props && looseEqual(vnode.props.value, value)) {
        return { checked: true };
      }
    };
    vModelCheckbox.getSSRProps = ({ value }, vnode) => {
      if (isArray(value)) {
        if (vnode.props && looseIndexOf(value, vnode.props.value) > -1) {
          return { checked: true };
        }
      } else if (isSet(value)) {
        if (vnode.props && value.has(vnode.props.value)) {
          return { checked: true };
        }
      } else if (value) {
        return { checked: true };
      }
    };
    vModelDynamic.getSSRProps = (binding, vnode) => {
      if (typeof vnode.type !== "string") {
        return;
      }
      const modelToUse = resolveDynamicModel(
        // resolveDynamicModel expects an uppercase tag name, but vnode.type is lowercase
        vnode.type.toUpperCase(),
        vnode.props && vnode.props.type
      );
      if (modelToUse.getSSRProps) {
        return modelToUse.getSSRProps(binding, vnode);
      }
    };
  }
  const systemModifiers = ["ctrl", "shift", "alt", "meta"];
  const modifierGuards = {
    stop: (e) => e.stopPropagation(),
    prevent: (e) => e.preventDefault(),
    self: (e) => e.target !== e.currentTarget,
    ctrl: (e) => !e.ctrlKey,
    shift: (e) => !e.shiftKey,
    alt: (e) => !e.altKey,
    meta: (e) => !e.metaKey,
    left: (e) => "button" in e && e.button !== 0,
    middle: (e) => "button" in e && e.button !== 1,
    right: (e) => "button" in e && e.button !== 2,
    exact: (e, modifiers) => systemModifiers.some((m) => e[`${m}Key`] && !modifiers.includes(m))
  };
  const withModifiers = (fn, modifiers) => {
    if (!fn) return fn;
    const cache = fn._withMods || (fn._withMods = {});
    const cacheKey = modifiers.join(".");
    return cache[cacheKey] || (cache[cacheKey] = ((event, ...args) => {
      for (let i = 0; i < modifiers.length; i++) {
        const guard = modifierGuards[modifiers[i]];
        if (guard && guard(event, modifiers)) return;
      }
      return fn(event, ...args);
    }));
  };
  const keyNames = {
    esc: "escape",
    space: " ",
    up: "arrow-up",
    left: "arrow-left",
    right: "arrow-right",
    down: "arrow-down",
    delete: "backspace"
  };
  const withKeys = (fn, modifiers) => {
    const cache = fn._withKeys || (fn._withKeys = {});
    const cacheKey = modifiers.join(".");
    return cache[cacheKey] || (cache[cacheKey] = ((event) => {
      if (!("key" in event)) {
        return;
      }
      const eventKey = hyphenate(event.key);
      if (modifiers.some(
        (k) => k === eventKey || keyNames[k] === eventKey
      )) {
        return fn(event);
      }
    }));
  };
  const rendererOptions = /* @__PURE__ */ extend({ patchProp }, nodeOps);
  let renderer;
  let enabledHydration = false;
  function ensureRenderer() {
    return renderer || (renderer = createRenderer(rendererOptions));
  }
  function ensureHydrationRenderer() {
    renderer = enabledHydration ? renderer : createHydrationRenderer(rendererOptions);
    enabledHydration = true;
    return renderer;
  }
  const render = ((...args) => {
    ensureRenderer().render(...args);
  });
  const hydrate = ((...args) => {
    ensureHydrationRenderer().hydrate(...args);
  });
  const createApp = ((...args) => {
    const app2 = ensureRenderer().createApp(...args);
    const { mount } = app2;
    app2.mount = (containerOrSelector) => {
      const container = normalizeContainer(containerOrSelector);
      if (!container) return;
      const component = app2._component;
      if (!isFunction(component) && !component.render && !component.template) {
        component.template = container.innerHTML;
      }
      if (container.nodeType === 1) {
        container.textContent = "";
      }
      const proxy = mount(container, false, resolveRootNamespace(container));
      if (container instanceof Element) {
        container.removeAttribute("v-cloak");
        container.setAttribute("data-v-app", "");
      }
      return proxy;
    };
    return app2;
  });
  const createSSRApp = ((...args) => {
    const app2 = ensureHydrationRenderer().createApp(...args);
    const { mount } = app2;
    app2.mount = (containerOrSelector) => {
      const container = normalizeContainer(containerOrSelector);
      if (container) {
        return mount(container, true, resolveRootNamespace(container));
      }
    };
    return app2;
  });
  function resolveRootNamespace(container) {
    if (container instanceof SVGElement) {
      return "svg";
    }
    if (typeof MathMLElement === "function" && container instanceof MathMLElement) {
      return "mathml";
    }
  }
  function normalizeContainer(container) {
    if (isString(container)) {
      const res = document.querySelector(container);
      return res;
    }
    return container;
  }
  let ssrDirectiveInitialized = false;
  const initDirectivesForSSR = () => {
    if (!ssrDirectiveInitialized) {
      ssrDirectiveInitialized = true;
      initVModelForSSR();
      initVShowForSSR();
    }
  };
  /**
  * vue v3.5.45
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  const compile = () => {
  };
  const Vue$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    BaseTransition,
    BaseTransitionPropsValidators,
    Comment,
    DeprecationTypes,
    EffectScope,
    ErrorCodes,
    ErrorTypeStrings,
    Fragment,
    KeepAlive,
    ReactiveEffect,
    Static,
    Suspense,
    Teleport,
    Text,
    TrackOpTypes,
    Transition,
    TransitionGroup,
    TriggerOpTypes,
    VueElement,
    assertNumber,
    callWithAsyncErrorHandling,
    callWithErrorHandling,
    camelize,
    capitalize,
    cloneVNode,
    compatUtils,
    compile,
    computed: computed$h,
    createApp,
    createBlock,
    createCommentVNode,
    createElementBlock,
    createElementVNode: createBaseVNode,
    createHydrationRenderer,
    createPropsRestProxy,
    createRenderer,
    createSSRApp,
    createSlots,
    createStaticVNode,
    createTextVNode,
    createVNode,
    customRef,
    defineAsyncComponent,
    defineComponent,
    defineCustomElement,
    defineEmits,
    defineExpose,
    defineModel,
    defineOptions,
    defineProps,
    defineSSRCustomElement,
    defineSlots,
    devtools,
    effect,
    effectScope,
    getCurrentInstance,
    getCurrentScope,
    getCurrentWatcher,
    getTransitionRawChildren,
    guardReactiveProps,
    h,
    handleError,
    hasInjectionContext,
    hydrate,
    hydrateOnIdle,
    hydrateOnInteraction,
    hydrateOnMediaQuery,
    hydrateOnVisible,
    initCustomFormatter,
    initDirectivesForSSR,
    inject,
    isMemoSame,
    isProxy,
    isReactive,
    isReadonly,
    isRef,
    isRuntimeOnly,
    isShallow,
    isVNode,
    markRaw,
    mergeDefaults,
    mergeModels,
    mergeProps,
    nextTick: nextTick$2,
    nodeOps,
    normalizeClass,
    normalizeProps,
    normalizeStyle,
    onActivated,
    onBeforeMount,
    onBeforeUnmount: onBeforeUnmount$2,
    onBeforeUpdate,
    onDeactivated,
    onErrorCaptured,
    onMounted: onMounted$d,
    onRenderTracked,
    onRenderTriggered,
    onScopeDispose,
    onServerPrefetch,
    onUnmounted: onUnmounted$9,
    onUpdated,
    onWatcherCleanup,
    openBlock,
    patchProp,
    popScopeId,
    provide,
    proxyRefs,
    pushScopeId,
    queuePostFlushCb,
    reactive: reactive$1,
    readonly,
    ref: ref$j,
    registerRuntimeCompiler,
    render,
    renderList,
    renderSlot,
    resolveComponent,
    resolveDirective,
    resolveDynamicComponent,
    resolveFilter,
    resolveTransitionHooks,
    setBlockTracking,
    setDevtoolsHook,
    setTransitionHooks,
    shallowReactive,
    shallowReadonly,
    shallowRef,
    ssrContextKey,
    ssrUtils,
    stop,
    toDisplayString,
    toHandlerKey,
    toHandlers,
    toRaw,
    toRef,
    toRefs,
    toValue,
    transformVNodeArgs,
    triggerRef,
    unref,
    useAttrs,
    useCssModule,
    useCssVars,
    useHost,
    useId,
    useModel,
    useSSRContext,
    useShadowRoot,
    useSlots,
    useTemplateRef,
    useTransitionState,
    vModelCheckbox,
    vModelDynamic,
    vModelRadio,
    vModelSelect,
    vModelText,
    vShow,
    version,
    warn,
    watch: watch$e,
    watchEffect,
    watchPostEffect,
    watchSyncEffect,
    withAsyncContext,
    withCtx,
    withDefaults,
    withDirectives,
    withKeys,
    withMemo,
    withModifiers,
    withScopeId
  }, Symbol.toStringTag, { value: "Module" }));
  window.Vue = Vue$1;
  const PREFIX = "/api/v1";
  let csrf = null;
  let csrfPromise = null;
  let generation = 0;
  let unauthorized = () => {
  };
  function onUnauthorized(handler) {
    unauthorized = handler;
  }
  function requireIdentity(stamp) {
    if (stamp !== generation) throw fail("登录身份已变化，请重试", "IDENTITY_CHANGED", 0);
  }
  function fail(message, code, status) {
    return Object.assign(new Error(message), { code, status });
  }
  async function getCsrf() {
    if (csrfPromise) return csrfPromise;
    const stamp = generation;
    const pending = (async () => {
      const data = await api("/auth/csrf", { retry: false });
      requireIdentity(stamp);
      csrf = data;
      return csrf;
    })();
    csrfPromise = pending;
    try {
      return await pending;
    } finally {
      if (csrfPromise === pending) csrfPromise = null;
    }
  }
  async function api(path, options = {}) {
    var _a, _b, _c;
    if ((options.method || "GET") !== "GET") return request(path, options);
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    (_a = options.signal) == null ? void 0 : _a.addEventListener("abort", abort, { once: true });
    if ((_b = options.signal) == null ? void 0 : _b.aborted) abort();
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs ?? 15e3);
    try {
      return await request(path, { ...options, signal: controller.signal });
    } catch (e) {
      if (timedOut) throw fail("请求超时，请重试", "TIMEOUT", 0);
      throw e;
    } finally {
      clearTimeout(timer);
      (_c = options.signal) == null ? void 0 : _c.removeEventListener("abort", abort);
    }
  }
  async function stream(path, { body, signal, onEvent, retry = true } = {}) {
    const stamp = generation;
    const token = csrf || await getCsrf();
    requireIdentity(stamp);
    const headers = {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      [token.headerName]: token.token
    };
    let response;
    try {
      response = await fetch(PREFIX + path, {
        method: "POST",
        headers,
        body: body === void 0 ? void 0 : JSON.stringify(body),
        signal,
        credentials: "same-origin",
        cache: "no-store"
      });
    } catch (err) {
      if (err.name === "AbortError") throw err;
      throw fail("服务连接失败，请确认 Java 后端已启动", "NETWORK", 0);
    }
    if (response.status === 403 && retry) {
      let payload = null;
      try {
        payload = await response.json();
      } catch {
      }
      if ((payload == null ? void 0 : payload.code) === "A0005") {
        csrf = null;
        await getCsrf();
        requireIdentity(stamp);
        return stream(path, { body, signal, onEvent, retry: false });
      }
    }
    if (!response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch {
      }
      if (response.status === 401 || (payload == null ? void 0 : payload.code) === "A0004") unauthorized();
      throw fail((payload == null ? void 0 : payload.info) || "请求失败", (payload == null ? void 0 : payload.code) || "HTTP", response.status);
    }
    if (!response.body) throw fail("服务器没有返回流式响应", "RESPONSE", response.status);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer2 = "";
    let eventName = "";
    let data = [];
    const dispatch = async () => {
      if (!eventName && !data.length) return;
      const raw = data.join("\n");
      const name = eventName || "message";
      eventName = "";
      data = [];
      if (!raw) return;
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        throw fail("服务器响应格式异常", "RESPONSE", response.status);
      }
      requireIdentity(stamp);
      if (onEvent) await onEvent(name, payload);
    };
    const consume = async (line) => {
      if (line.length > 65536) throw fail("流式响应超过大小限制", "RESPONSE", response.status);
      if (!line) return dispatch();
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) {
        data.push(line.slice(5).trim());
        if (data.join("\n").length > 1e6)
          throw fail("流式响应超过大小限制", "RESPONSE", response.status);
      }
    };
    while (true) {
      const chunk = await reader.read();
      buffer2 += decoder.decode(chunk.value || new Uint8Array(), { stream: !chunk.done });
      let end;
      while ((end = buffer2.indexOf("\n")) >= 0) {
        const line = buffer2.slice(0, end).replace(/\r$/, "");
        buffer2 = buffer2.slice(end + 1);
        await consume(line);
      }
      if (chunk.done) break;
    }
    if (buffer2) await consume(buffer2.replace(/\r$/, ""));
    await dispatch();
  }
  async function request(path, { method = "GET", body, signal, key, retry = true } = {}) {
    const stamp = generation;
    const payload = body === void 0 ? void 0 : JSON.stringify(body);
    const headers = { Accept: "application/json" };
    if (method !== "GET") {
      const token = csrf || await getCsrf();
      requireIdentity(stamp);
      headers[token.headerName] = token.token;
    }
    if (body !== void 0) headers["Content-Type"] = "application/json";
    if (key) headers["Idempotency-Key"] = key;
    let r;
    try {
      r = await fetch(PREFIX + path, {
        method,
        headers,
        body: payload,
        signal,
        credentials: "same-origin",
        cache: "no-store"
      });
    } catch (err) {
      if (err.name === "AbortError") throw err;
      throw fail("服务连接失败，请确认 Java 后端已启动", "NETWORK", 0);
    }
    let j;
    try {
      j = await r.json();
    } catch (e) {
      if (e.name === "AbortError") throw e;
      throw fail("服务器响应格式异常", "RESPONSE", r.status);
    }
    requireIdentity(stamp);
    if (r.status === 401 || j.code === "A0004") unauthorized();
    if (r.status === 403 && j.code === "A0005" && retry) {
      csrf = null;
      await getCsrf();
      requireIdentity(stamp);
      return api(path, {
        method,
        body: payload === void 0 ? void 0 : JSON.parse(payload),
        signal,
        key,
        retry: false
      });
    }
    if (!r.ok || j.code !== "0000") throw fail(j.info || "请求失败", j.code || "HTTP", r.status);
    return j.data;
  }
  const resetCsrf = () => {
    ++generation;
    csrf = null;
    csrfPromise = null;
  };
  const query = (params) => "?" + new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== void 0 && v !== null && v !== "")
  ).toString();
  const idempotency = () => crypto.randomUUID();
  const modal = {
    mounted(element, binding) {
      const previous = document.activeElement;
      const dialog = element.querySelector('[role="dialog"]') || element.querySelector("form") || element;
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.tabIndex = -1;
      const controls = () => [...dialog.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(
        (el) => !el.disabled && el.getClientRects().length
      );
      const keydown = (event) => {
        var _a;
        if (event.key === "Escape") {
          event.preventDefault();
          (_a = binding.value) == null ? void 0 : _a.call(binding);
        }
        if (event.key !== "Tab") return;
        const list = controls(), first = list[0] || dialog, last = list.at(-1) || dialog;
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
          event.preventDefault();
          first.focus();
        }
      };
      element.addEventListener("keydown", keydown);
      (controls()[0] || dialog).focus();
      element.__disposeModal = () => {
        element.removeEventListener("keydown", keydown);
        if (previous == null ? void 0 : previous.isConnected) previous.focus();
      };
    },
    unmounted(element) {
      var _a;
      (_a = element.__disposeModal) == null ? void 0 : _a.call(element);
    }
  };
  const paths = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    arrowLeft: '<path d="m15 18-6-6 6-6"/>',
    arrowUpRight: '<path d="M7 17 17 7M8 7h9v9"/>',
    home: '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
    sparkles: '<path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/>',
    cart: '<circle cx="10" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M2 3h2l3 13h13l2-9H5"/>',
    order: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 3-7 8-7s8 2 8 7"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>',
    pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    store: '<path d="M3 9 5 3h14l2 6M3 9v11h18V9M9 20v-7h6v7"/><path d="M2 9c0 3 4 3 5 0 1 3 4 3 5 0 1 3 4 3 5 0 1 3 5 3 5 0"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    package: '<path d="m12 2 9 5-9 5-9-5zM3 7v10l9 5 9-5V7M12 12v10"/>',
    box: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 8h10M7 12h10M7 16h7"/>',
    clipboard: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M9 5V3h6v2M8 11h8M8 15h8"/>',
    scan: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M4 12h16"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M19 20v-2a6 6 0 0 0-3-5"/>',
    book: '<path d="M12 6c-3-3-7-3-10-2v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2zM12 6v15"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M5 5 19 19M19 5 5 19"/>',
    check: '<path d="M4 12 10 18 20 6"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14-5L3 9M3 3v6h6M4 13a8 8 0 0 0 14 5l3-3M21 21v-6h-6"/>',
    edit: '<path d="M4 20h4L20 8l-4-4L4 16zM14 6l4 4"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v8M14 10v8"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
    send: '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    shield: '<path d="m12 2 9 4v6c0 5-3 8-9 10-6-2-9-5-9-10V6z"/><path d="m8 12 3 3 5-6"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14c2 2 6 2 8 0M8 9h.01M16 9h.01"/>',
    circleHelp: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9.5a2.5 2.5 0 0 1 4.3 1.6c0 1.7-2.1 2-2.1 3.4M12 18h.01"/>',
    alert: '<path d="m12 2 10 18H2zM12 8v5M12 17h.01"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    logout: '<path d="M9 3H4v18h5M13 7l5 5-5 5M7 12h11"/>'
  };
  const Icon = {
    name: "UiIcon",
    props: {
      name: { type: String, required: true },
      size: { type: [Number, String], default: 20 },
      stroke: { type: Number, default: 1.85 }
    },
    setup(props) {
      return () => Vue.h("svg", {
        viewBox: "0 0 24 24",
        width: props.size,
        height: props.size,
        "aria-hidden": "true",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": props.stroke,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        innerHTML: paths[props.name] || paths.circleHelp
      });
    }
  };
  const DEMO_MERCHANTS = [
    {
      merchantId: "preview-m1",
      name: "东湖便利",
      storeName: "学一食堂店",
      location: "东湖校区 · 学一食堂一层",
      category: "便利零售",
      status: "ACTIVE",
      image: "./images/merch-convenience.webp"
    },
    {
      merchantId: "preview-m2",
      name: "青果时间",
      storeName: "生活区店",
      location: "生活区 B 栋",
      category: "水果生鲜",
      status: "ACTIVE",
      image: "./images/merch-fruit.webp"
    },
    {
      merchantId: "preview-m3",
      name: "学伴文具",
      storeName: "图书馆店",
      location: "图书馆一层",
      category: "文具用品",
      status: "ACTIVE",
      image: "./images/merch-supermarket.webp"
    }
  ];
  const DEMO_CATEGORIES = [
    { code: "food", name: "零食", active: true, image: "./images/category-snacks.webp" },
    { code: "drink", name: "饮料", active: true, image: "./images/category-drinks.webp" },
    { code: "fruit", name: "水果", active: true, image: "./images/category-fruit.webp" },
    { code: "stationery", name: "文具", active: true, image: "./images/category-stationery.webp" },
    { code: "daily", name: "日用", active: true, image: "./images/category-daily.webp" }
  ];
  const sku = (n, spec, price, available2) => ({
    skuId: "preview-sku-" + n,
    specKey: spec,
    priceCent: price,
    status: "ACTIVE",
    quoteVersion: 1,
    available: available2
  });
  const DEMO_PRODUCTS = [
    {
      productId: "preview-p1",
      merchantId: "preview-m1",
      title: "红烧牛肉面 · 经典桶",
      description: "经典浓香，随时享用。",
      categoryCode: "food",
      imageUrl: "./images/noodles.webp",
      status: "PUBLISHED",
      version: 1,
      skus: [sku(1, "109g", 450, 320)],
      tag: "热卖",
      sub: "109g"
    },
    {
      productId: "preview-p2",
      merchantId: "preview-m1",
      title: "纯牛奶 250ml",
      description: "原味纯牛奶",
      categoryCode: "drink",
      imageUrl: "./images/milk.webp",
      status: "PUBLISHED",
      version: 1,
      skus: [sku(2, "250ml", 280, 86)],
      tag: "精选",
      sub: "250ml"
    },
    {
      productId: "preview-p3",
      merchantId: "preview-m1",
      title: "经典原味薯片",
      description: "香脆轻食",
      categoryCode: "food",
      imageUrl: "./images/chips.webp",
      status: "PUBLISHED",
      version: 1,
      skus: [sku(3, "70g", 420, 168)],
      tag: "热卖",
      sub: "70g"
    },
    {
      productId: "preview-p4",
      merchantId: "preview-m2",
      title: "鲜脆青苹果",
      description: "新鲜水果",
      categoryCode: "fruit",
      imageUrl: "./images/category-fruit.webp",
      status: "PUBLISHED",
      version: 2,
      skus: [sku(4, "单个", 180, 76)],
      tag: "当季",
      sub: "约200g"
    },
    {
      productId: "preview-p5",
      merchantId: "preview-m3",
      title: "考试中性笔",
      description: "顺滑书写",
      categoryCode: "stationery",
      imageUrl: "./images/category-stationery.webp",
      status: "PUBLISHED",
      version: 2,
      skus: [sku(5, "0.5mm", 250, 123)],
      tag: "常备",
      sub: "单支"
    },
    {
      productId: "preview-p6",
      merchantId: "preview-m1",
      title: "牛奶 250ml · 整箱",
      description: "12盒装",
      categoryCode: "drink",
      imageUrl: "./images/milk.webp",
      status: "PUBLISHED",
      version: 3,
      skus: [sku(6, "12盒装", 3150, 12)],
      tag: "好价",
      sub: "12盒装"
    },
    {
      productId: "preview-p7",
      merchantId: "preview-m1",
      title: "经典桶面 · 香辣",
      description: "更浓郁的味道",
      categoryCode: "food",
      imageUrl: "./images/noodles.webp",
      status: "UNPUBLISHED",
      version: 3,
      skus: [sku(7, "109g", 450, 0)],
      sub: "109g"
    },
    {
      productId: "preview-p8",
      merchantId: "preview-m1",
      title: "洗护旅行装",
      description: "便携日用",
      categoryCode: "daily",
      imageUrl: "./images/category-daily.webp",
      status: "PUBLISHED",
      version: 1,
      skus: [sku(8, "100ml", 690, 16)],
      sub: "100ml"
    },
    {
      productId: "preview-p9",
      merchantId: "preview-m1",
      title: "红烧牛肉面 · 整箱",
      description: "整箱囤货",
      categoryCode: "food",
      imageUrl: "./images/noodles.webp",
      status: "PUBLISHED",
      version: 1,
      skus: [sku(9, "12桶装", 4950, 8)],
      sub: "12桶装"
    },
    {
      productId: "preview-p10",
      merchantId: "preview-m1",
      title: "青苹果 · 礼盒",
      description: "节日礼盒",
      categoryCode: "fruit",
      imageUrl: "./images/category-fruit.webp",
      status: "DRAFT",
      version: 1,
      skus: [sku(10, "8枚装", 2280, 0)],
      sub: "8枚装"
    }
  ];
  const DEMO_STOCKS = DEMO_PRODUCTS.filter((p2) => p2.merchantId === "preview-m1").flatMap(
    (p2) => p2.skus.map((s) => ({
      skuId: s.skuId,
      storeId: "preview-s1",
      onHand: s.available + 2,
      reserved: 2,
      available: s.available,
      version: 1
    }))
  );
  const DEMO_CHAT = [
    { role: "user", content: "我想买点夜宵，预算 30 元以内，吃得饱一点。" },
    { role: "assistant", content: "给你挑了 3 件方便自提的好物。", demo: true }
  ];
  const { reactive } = Vue;
  const preview = window.__CAMPUS_TEST_DEMO__ === true || new URLSearchParams(location.search).get("demo") === "1";
  const store = reactive({
    preview,
    route: window.__CAMPUS_TEST_ROUTE__ || location.hash.replace(/^#/, "") || "/",
    products: [],
    merchants: [],
    categories: [],
    stocks: [],
    user: null,
    identityVersion: 0,
    workspace: null,
    merchantId: "",
    loading: false,
    error: "",
    toast: "",
    cartCount: 0,
    messages: [],
    conversationId: "",
    proposal: null,
    photo: null,
    reloadId: 0,
    publicPage: { page: 1, size: 20, total: 0, hasNext: false },
    merchantPage: { page: 1, size: 12, total: 0, hasNext: false }
  });
  const money = (cent) => "¥" + (Number(cent || 0) / 100).toFixed(2).replace(/\.00$/, "");
  const skuOf = (p2) => {
    var _a, _b;
    return ((_a = p2 == null ? void 0 : p2.skus) == null ? void 0 : _a.find((s) => s.status === "ACTIVE")) || ((_b = p2 == null ? void 0 : p2.skus) == null ? void 0 : _b[0]) || {};
  };
  const available = (p2) => {
    var _a;
    return ((_a = p2 == null ? void 0 : p2.skus) == null ? void 0 : _a.filter((s) => s.status === "ACTIVE").reduce((n, s) => n + Number(s.available || 0), 0)) || 0;
  };
  const shopName = (id) => {
    var _a;
    return ((_a = store.merchants.find((m) => m.merchantId === id)) == null ? void 0 : _a.name) || "校内商户";
  };
  let toastTimer;
  let merchantEpoch = 0, sessionEpoch = 0, publicEpoch = 0, baseEpoch = 0;
  const actorId = (user) => (user == null ? void 0 : user.userId) || (user == null ? void 0 : user.id) || (user == null ? void 0 : user.username) || "";
  function replaceSession(user) {
    resetCsrf();
    ++store.identityVersion;
    ++sessionEpoch;
    ++baseEpoch;
    ++merchantEpoch;
    ++publicEpoch;
    store.user = user;
    store.workspace = null;
    store.merchantId = "";
    store.products = [];
    store.stocks = [];
    store.merchants = [];
    store.conversationId = "";
    store.messages = [];
    store.proposal = null;
    store.cartCount = 0;
    store.photo = null;
    store.loading = false;
    store.error = "";
    store.toast = "";
    clearTimeout(toastTimer);
    store.publicPage = { page: 1, size: 20, total: 0, hasNext: false };
    store.merchantPage = { page: 1, size: 9, total: 0, hasNext: false };
  }
  onUnauthorized(() => {
    if (store.user || store.workspace || store.merchantId || store.messages.length || store.proposal || store.photo || store.cartCount)
      replaceSession(null);
  });
  function switchMerchantContext(id) {
    if (id === store.merchantId) return;
    ++merchantEpoch;
    store.merchantId = id;
    store.products = [];
    store.stocks = [];
    store.merchantPage = { page: 1, size: 9, total: 0, hasNext: false };
    store.error = "";
  }
  function invalidateMerchantSearch() {
    ++merchantEpoch;
  }
  function beginPublicSearch() {
    return ++publicEpoch;
  }
  function publicSearchCurrent(stamp) {
    return stamp === publicEpoch;
  }
  function notify(message) {
    store.toast = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => store.toast = "", 3200);
  }
  function go(path) {
    location.hash = path;
  }
  function setRoute() {
    const next = location.hash.replace(/^#/, "") || "/";
    if (next !== store.route) {
      ++publicEpoch;
      ++merchantEpoch;
      store.loading = false;
    }
    store.route = next;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }
  async function loadPublic({ signal } = {}) {
    const stamp = ++publicEpoch, baseStamp = ++baseEpoch;
    store.error = "";
    store.loading = true;
    if (preview) {
      store.products = DEMO_PRODUCTS.filter((p2) => p2.status === "PUBLISHED");
      store.merchants = DEMO_MERCHANTS;
      store.categories = DEMO_CATEGORIES;
      store.publicPage = { page: 1, size: 20, total: store.products.length, hasNext: false };
      store.loading = false;
      return;
    }
    try {
      const [merchants, categories, products] = await Promise.all([
        api("/merchants/public/page" + query({ page: 1, size: 50 }), { signal }).then((result) => {
          if (baseStamp === baseEpoch) store.merchants = (result == null ? void 0 : result.items) || [];
          return result;
        }),
        api("/categories", { signal }).then((result) => {
          if (baseStamp === baseEpoch) store.categories = result || [];
          return result;
        }),
        api("/products/page" + query({ page: 1, size: 20 }), { signal })
      ]);
      if (!publicSearchCurrent(stamp)) return;
      store.merchants = (merchants == null ? void 0 : merchants.items) || [];
      store.categories = categories || [];
      store.products = (products == null ? void 0 : products.items) || [];
      store.publicPage = {
        page: (products == null ? void 0 : products.page) || 1,
        size: (products == null ? void 0 : products.size) || 20,
        total: (products == null ? void 0 : products.total) || 0,
        hasNext: !!(products == null ? void 0 : products.hasNext)
      };
    } catch (err) {
      if (publicSearchCurrent(stamp)) {
        store.error = err.message;
        store.products = [];
      }
    } finally {
      if (publicSearchCurrent(stamp)) store.loading = false;
    }
  }
  async function loadMerchant({
    page = 1,
    size = 9,
    q = "",
    category = "",
    status = "",
    sort = "NEWEST",
    contextOnly = false,
    signal
  } = {}) {
    var _a, _b, _c;
    const stamp = ++merchantEpoch, authStamp = sessionEpoch;
    const requested = store.merchantId, originalActor = actorId(store.user);
    let target = requested;
    const current = () => stamp === merchantEpoch && authStamp === sessionEpoch && store.route.startsWith("/merchant") && store.merchantId === requested && actorId(store.user) === originalActor;
    if (!["PUBLISHED", "DRAFT", "UNPUBLISHED", "LOW_STOCK"].includes(status)) status = "";
    store.error = "";
    store.loading = true;
    if (preview) {
      store.products = DEMO_PRODUCTS.filter((p2) => p2.merchantId === "preview-m1");
      store.stocks = DEMO_STOCKS;
      store.merchantPage = { page: 1, size: 12, total: store.products.length, hasNext: false };
      store.categories = DEMO_CATEGORIES;
      store.merchants = DEMO_MERCHANTS;
      store.merchantId = "preview-m1";
      store.workspace = {
        merchants: DEMO_MERCHANTS.slice(0, 1),
        memberships: [{ merchantId: "preview-m1", role: "OWNER", status: "ACTIVE" }]
      };
      store.user = { displayName: "演示店长" };
      store.loading = false;
      return;
    }
    try {
      const [user, workspace, categories] = store.workspace && store.user && !contextOnly ? [store.user, store.workspace, store.categories] : await Promise.all([
        store.user ? Promise.resolve(store.user) : api("/auth/me"),
        api("/workspace"),
        api("/categories")
      ]);
      if (!current()) return;
      const options = (workspace == null ? void 0 : workspace.merchants) || [];
      const next = ((_a = options.find((m) => m.merchantId === requested)) == null ? void 0 : _a.merchantId) || ((_b = options[0]) == null ? void 0 : _b.merchantId) || "";
      store.user = user;
      store.workspace = workspace;
      store.categories = categories || [];
      store.merchants = options;
      store.merchantId = next;
      target = next;
      if (!next) {
        store.products = [];
        store.stocks = [];
        store.error = "当前账号没有商户权限";
        return;
      }
      if (contextOnly) return;
      const id = encodeURIComponent(next), permissions = ((_c = workspace == null ? void 0 : workspace.merchantPermissions) == null ? void 0 : _c[next]) || [];
      const read = (path) => api(path, { signal });
      const [products, stocks] = await Promise.all([
        permissions.includes("product.read") ? read(`/merchants/${id}/products/page` + query({ page, size, q, category, status, sort })) : Promise.resolve({ items: [], page: 1, size, total: 0, hasNext: false }),
        permissions.includes("stock.read") && !contextOnly ? read(`/merchants/${id}/stocks/page` + query({ page: 1, size: 100 })) : Promise.resolve({ items: [] })
      ]);
      if (stamp !== merchantEpoch || authStamp !== sessionEpoch || !store.route.startsWith("/merchant") || store.merchantId !== next || actorId(store.user) !== actorId(user))
        return;
      store.products = (products == null ? void 0 : products.items) || [];
      store.merchantPage = {
        page: (products == null ? void 0 : products.page) || 1,
        size: (products == null ? void 0 : products.size) || size,
        total: (products == null ? void 0 : products.total) || 0,
        hasNext: !!(products == null ? void 0 : products.hasNext)
      };
      store.stocks = (stocks == null ? void 0 : stocks.items) || [];
    } catch (err) {
      if (stamp === merchantEpoch && authStamp === sessionEpoch && store.route.startsWith("/merchant") && store.merchantId === target) {
        store.error = err.status === 401 ? "请先在现有站点登录商户账号" : err.message;
        store.products = [];
        store.stocks = [];
      }
    } finally {
      if (stamp === merchantEpoch && authStamp === sessionEpoch) store.loading = false;
    }
  }
  async function loadSession() {
    if (preview) return;
    const stamp = sessionEpoch, original = actorId(store.user);
    try {
      const user = await api("/auth/me");
      if (stamp === sessionEpoch && actorId(store.user) === original) store.user = user;
    } catch (err) {
      if (err.status !== 401 && err.code !== "A0004") throw err;
      if (stamp === sessionEpoch && actorId(store.user) === original && store.user && (err.status === 401 || err.code === "A0004"))
        replaceSession(null);
    }
  }
  function hasPermission(code, merchantId = store.merchantId) {
    var _a, _b, _c;
    return preview || !!((_c = (_b = (_a = store.workspace) == null ? void 0 : _a.merchantPermissions) == null ? void 0 : _b[merchantId]) == null ? void 0 : _c.includes(code));
  }
  function isOwner() {
    var _a, _b;
    return preview || !!((_b = (_a = store.workspace) == null ? void 0 : _a.memberships) == null ? void 0 : _b.some(
      (m) => m.merchantId === store.merchantId && m.role === "OWNER" && m.status === "ACTIVE"
    ));
  }
  function previewGuard() {
    if (!preview) return false;
    notify("设计预览：不会修改服务器数据");
    return true;
  }
  function requestScope() {
    let alive = true, epoch = 0, controller;
    Vue.onBeforeUnmount(() => {
      alive = false;
      controller == null ? void 0 : controller.abort();
    });
    function capture() {
      const identity = store.identityVersion, route = store.route, merchant = store.merchantId;
      return () => alive && identity === store.identityVersion && route === store.route && merchant === store.merchantId;
    }
    function begin() {
      controller == null ? void 0 : controller.abort();
      controller = new AbortController();
      const stamp = ++epoch, valid = capture();
      return { signal: controller.signal, current: () => stamp === epoch && valid() };
    }
    return { capture, begin };
  }
  const statusLabel = (names2) => (value) => names2[value] || (value ? "未知状态" : "—");
  const orderStatusLabel = statusLabel({
    PENDING_PAYMENT: "待付款",
    PAID: "已支付",
    COMPLETED: "已完成",
    CANCELED: "已取消",
    REFUNDED: "已退款"
  });
  const afterSaleStatusLabel = statusLabel({
    REQUESTED: "待商户审核",
    APPROVED: "已批准退款",
    REJECTED: "已驳回",
    DISPUTED: "待平台裁决",
    REFUNDED: "已退款"
  });
  const applicationStatusLabel = statusLabel({
    SUBMITTED: "待审核",
    APPROVED: "已通过",
    REJECTED: "已驳回"
  });
  const merchantStatusLabel = statusLabel({
    ACTIVE: "营业中",
    SUSPENDED: "暂停营业"
  });
  const productStatusLabel = statusLabel({
    DRAFT: "草稿",
    PUBLISHED: "已上架",
    UNPUBLISHED: "已下架"
  });
  const pickupStatusLabel = statusLabel({
    WAIT_PREP: "待备货",
    CREATED: "待备货",
    PREPARING: "备货中",
    READY: "待自提",
    VERIFIED: "已核销",
    CANCELED: "已取消",
    COMPLETED: "已核销"
  });
  const membershipStatusLabel = statusLabel({ ACTIVE: "有效成员", REVOKED: "已撤销" });
  const orderEventLabel = statusLabel({
    ORDER_CREATED: "已下单",
    PAYMENT_SUCCEEDED: "已付款",
    PREPARING: "商户备货中",
    READY: "备货完成，待自提",
    PICKED_UP: "已核销",
    CANCELED: "已取消",
    EXPIRED: "已过期",
    REFUND_REQUESTED: "申请退款",
    MERCHANT_REJECTED: "商户驳回退款",
    MERCHANT_APPROVED: "商户同意退款",
    REFUND_DISPUTED: "申请平台介入",
    PLATFORM_APPROVED: "平台裁决同意退款",
    PLATFORM_REJECTED: "平台裁决驳回退款",
    REFUND_COMPLETED: "模拟退款完成"
  });
  const invitationStatusLabel = statusLabel({
    PENDING: "待接受",
    ACCEPTED: "已接受",
    CANCELED: "已取消",
    EXPIRED: "已过期"
  });
  function invitationIsExpired(invitation, now = Date.now()) {
    if (!invitation) return false;
    if (invitation.status === "EXPIRED") return true;
    if (invitation.status !== "PENDING" || !invitation.expiresAt) return false;
    const expiresAt = Date.parse(invitation.expiresAt);
    return Number.isFinite(expiresAt) && expiresAt <= now;
  }
  const knowledgeIndexStatusLabel = statusLabel({
    PENDING: "待索引",
    INDEXING: "索引中",
    READY: "索引就绪",
    FAILED: "索引失败"
  });
  const knowledgeStatusLabel = statusLabel({
    DRAFT: "草稿",
    PUBLISHED: "已发布",
    WITHDRAWN: "已撤回"
  });
  const knowledgeVisibilityLabel = statusLabel({
    MERCHANT_INTERNAL: "商户内部",
    PLATFORM_INTERNAL: "平台内部",
    PUBLIC: "公开"
  });
  const inventoryOperationLabel = statusLabel({
    REPLENISH: "补货",
    RESERVE: "库存预占",
    RELEASE: "释放预占",
    CONSUME: "核销出库"
  });
  function priceSku(product) {
    return [...(product == null ? void 0 : product.skus) || []].filter((sku2) => sku2.status === "ACTIVE").sort((a, b) => Number(a.priceCent) - Number(b.priceCent))[0] || null;
  }
  function inventoryQuantityLabel(move) {
    const quantity = move.quantity;
    switch (move.type) {
      case "REPLENISH":
        return `实物增加 ${quantity}`;
      case "RESERVE":
        return `预占增加 ${quantity}`;
      case "RELEASE":
        return `预占减少 ${quantity}`;
      case "CONSUME":
        return `实物减少 ${quantity}，预占减少 ${quantity}`;
      default:
        return `数量 ${quantity}`;
    }
  }
  function dateTime(v) {
    if (!v) return "—";
    const d = new Date(v);
    return isNaN(d) ? String(v) : d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  function safeDecodeId(v) {
    try {
      return decodeURIComponent(v || "");
    } catch {
      return "";
    }
  }
  function pathId(v) {
    return encodeURIComponent(String(v || ""));
  }
  function coverSku(skuId) {
    const p2 = store.products.find((p3) => {
      var _a;
      return (_a = p3.skus) == null ? void 0 : _a.some((s) => s.skuId === skuId);
    });
    return (p2 == null ? void 0 : p2.imageUrl) || "";
  }
  function positiveInt(v, max = 99) {
    return Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= max;
  }
  const { ref: ref$i } = Vue;
  const AuthDialog = {
    name: "AuthDialog",
    emits: ["close", "success"],
    setup(props, { emit: emit2 }) {
      const mode = ref$i("login");
      const username = ref$i("");
      const password = ref$i("");
      const displayName = ref$i("");
      const busy = ref$i(false);
      const error = ref$i("");
      async function submit() {
        if (busy.value) return;
        error.value = "";
        if (!username.value.trim() || !password.value) {
          error.value = "请填写账号和密码";
          return;
        }
        if (mode.value === "register") {
          if (!/^[a-z][a-z0-9_]{3,31}$/.test(username.value.trim().toLowerCase())) {
            error.value = "用户名须为4~32位，以字母开头，仅含字母、数字和下划线";
            return;
          }
          if (password.value.length < 8 || password.value.length > 64 || new TextEncoder().encode(password.value).length > 72) {
            error.value = "密码须为8~64字符，且UTF-8编码不超过72字节";
            return;
          }
        }
        busy.value = true;
        try {
          if (mode.value === "register") {
            await api("/auth/register", {
              method: "POST",
              body: {
                username: username.value.trim(),
                password: password.value,
                displayName: displayName.value.trim() || username.value.trim()
              }
            });
            mode.value = "login";
            password.value = "";
            notify("注册成功，请登录");
          } else {
            const user = await api("/auth/login", {
              method: "POST",
              body: { username: username.value.trim(), password: password.value }
            });
            resetCsrf();
            replaceSession(user);
            password.value = "";
            emit2("success", user);
            emit2("close");
            notify("已登录");
          }
        } catch (err) {
          error.value = err.message;
        } finally {
          busy.value = false;
        }
      }
      return { mode, username, password, displayName, busy, error, submit };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode2, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, vModelText: _vModelText, withDirectives: _withDirectives, Fragment: _Fragment, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, withModifiers: _withModifiers, resolveDirective: _resolveDirective } = Vue;
      return function render2(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _directive_modal = _resolveDirective("modal");
        return _withDirectives((_openBlock(), _createElementBlock("div", {
          class: "ui-overlay",
          onClick: _withModifiers(($event) => _ctx.$emit("close"), ["self"])
        }, [
          _createElementVNode("form", {
            class: "login-dialog",
            onSubmit: _withModifiers(_ctx.submit, ["prevent"]),
            "aria-label": "账号登录"
          }, [
            _createElementVNode("div", { class: "login-dialog-heading" }, [
              _createElementVNode("span", { class: "auth-logo" }, [
                _createVNode2(_component_Icon, {
                  name: "sparkles",
                  size: 22
                })
              ]),
              _createElementVNode("button", {
                type: "button",
                onClick: ($event) => _ctx.$emit("close"),
                "aria-label": "关闭登录窗"
              }, [
                _createVNode2(_component_Icon, {
                  name: "x",
                  size: 20
                })
              ], 8, ["onClick"])
            ]),
            _createElementVNode(
              "h2",
              null,
              _toDisplayString(_ctx.mode === "login" ? "欢迎回来" : "创建账号"),
              1
              /* TEXT */
            ),
            _createElementVNode("label", { for: "login-name" }, "账号"),
            _withDirectives(_createElementVNode("input", {
              id: "login-name",
              "onUpdate:modelValue": ($event) => _ctx.username = $event,
              autocomplete: "username",
              minlength: _ctx.mode === "register" ? 4 : void 0,
              required: "",
              maxlength: "32",
              placeholder: "用户名"
            }, null, 8, ["onUpdate:modelValue", "minlength"]), [
              [_vModelText, _ctx.username]
            ]),
            _createElementVNode("label", { for: "login-password" }, "密码"),
            _withDirectives(_createElementVNode("input", {
              id: "login-password",
              "onUpdate:modelValue": ($event) => _ctx.password = $event,
              type: "password",
              autocomplete: _ctx.mode === "login" ? "current-password" : "new-password",
              required: "",
              minlength: _ctx.mode === "register" ? 8 : void 0,
              maxlength: _ctx.mode === "register" ? 64 : void 0,
              placeholder: "输入密码"
            }, null, 8, ["onUpdate:modelValue", "autocomplete", "minlength", "maxlength"]), [
              [_vModelText, _ctx.password]
            ]),
            _ctx.mode === "register" ? (_openBlock(), _createElementBlock(
              _Fragment,
              { key: 0 },
              [
                _createElementVNode("small", null, "用户名4~32位，字母开头，仅含字母、数字、下划线；密码8~64字符，UTF-8不超过72字节。"),
                _createElementVNode("label", { for: "login-display" }, "昵称"),
                _withDirectives(_createElementVNode("input", {
                  id: "login-display",
                  "onUpdate:modelValue": ($event) => _ctx.displayName = $event,
                  maxlength: "50",
                  placeholder: "昵称（选填）"
                }, null, 8, ["onUpdate:modelValue"]), [
                  [_vModelText, _ctx.displayName]
                ])
              ],
              64
              /* STABLE_FRAGMENT */
            )) : _createCommentVNode("v-if", true),
            _ctx.error ? (_openBlock(), _createElementBlock(
              "div",
              {
                key: 1,
                class: "login-error"
              },
              _toDisplayString(_ctx.error),
              1
              /* TEXT */
            )) : _createCommentVNode("v-if", true),
            _createElementVNode("button", {
              type: "submit",
              class: "primary-wide login-submit",
              disabled: _ctx.busy
            }, _toDisplayString(_ctx.busy ? "请稍候…" : _ctx.mode === "login" ? "登录" : "注册"), 9, ["disabled"]),
            _createElementVNode("button", {
              type: "button",
              class: "login-switch",
              onClick: ($event) => {
                _ctx.mode = _ctx.mode === "login" ? "register" : "login";
                _ctx.error = "";
              }
            }, _toDisplayString(_ctx.mode === "login" ? "没有账号？注册" : "已有账号？登录"), 9, ["onClick"])
          ], 40, ["onSubmit"])
        ], 8, ["onClick"])), [
          [_directive_modal, () => _ctx.$emit("close")]
        ]);
      };
    })()
  };
  const { ref: ref$h } = Vue;
  const ConsumerShell = {
    name: "ConsumerShell",
    components: { AuthDialog },
    props: { active: { type: String, default: "home" } },
    setup() {
      const loginOpen = ref$h(false);
      async function logout() {
        try {
          await api("/auth/logout", { method: "POST" });
          resetCsrf();
          replaceSession(null);
          notify("已退出");
          go("/");
        } catch (err) {
          notify(err.message);
        }
      }
      return { go, store, preview, loginOpen, logout };
    },
    render: (() => {
      const { createElementVNode: _createElementVNode, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, toDisplayString: _toDisplayString, resolveComponent: _resolveComponent, createVNode: _createVNode2, createTextVNode: _createTextVNode, renderSlot: _renderSlot, normalizeClass: _normalizeClass, createBlock: _createBlock } = Vue;
      return function render2(_ctx, _cache) {
        var _a;
        const _component_Icon = _resolveComponent("Icon");
        const _component_AuthDialog = _resolveComponent("AuthDialog");
        return _openBlock(), _createElementBlock("div", { class: "consumer-shell" }, [
          _createElementVNode("div", { class: "consumer-width" }, [
            _createElementVNode("header", { class: "consumer-header" }, [
              _createElementVNode("div", { class: "campus-location" }, [
                _createElementVNode("div", { class: "brand-pin" }, [
                  _createElementVNode("span")
                ]),
                _createElementVNode("div", null, [
                  _createElementVNode("div", { class: "location-name" }, "青柠校园"),
                  _createElementVNode("div", { class: "location-sub" }, "校园好物 · 到店自提")
                ])
              ]),
              _createElementVNode("div", { class: "header-trailing" }, [
                _ctx.store.preview ? (_openBlock(), _createElementBlock("span", {
                  key: 0,
                  class: "demo-pill",
                  title: "仅用于视觉预览"
                }, "设计预览")) : !_ctx.store.user ? (_openBlock(), _createElementBlock("button", {
                  key: 1,
                  class: "header-login",
                  onClick: ($event) => _ctx.loginOpen = true
                }, "登录", 8, ["onClick"])) : (_openBlock(), _createElementBlock("button", {
                  key: 2,
                  class: "account-pill",
                  onClick: _ctx.logout,
                  title: "退出登录"
                }, [
                  _createTextVNode(
                    _toDisplayString(((_a = _ctx.store.user.displayName) == null ? void 0 : _a.slice(0, 2)) || "我") + " ",
                    1
                    /* TEXT */
                  ),
                  _createVNode2(_component_Icon, {
                    name: "logout",
                    size: 12
                  })
                ], 8, ["onClick"]))
              ])
            ]),
            _createElementVNode("main", { class: "consumer-main" }, [
              _renderSlot(_ctx.$slots, "default")
            ])
          ]),
          _createElementVNode("nav", {
            class: "mobile-tabbar",
            "aria-label": "消费者导航"
          }, [
            _createElementVNode("div", { class: "mobile-tabbar-inner" }, [
              _createElementVNode("button", {
                class: _normalizeClass({ selected: _ctx.active === "home" }),
                onClick: ($event) => _ctx.go("/"),
                "aria-label": "首页"
              }, [
                _createVNode2(_component_Icon, {
                  name: "home",
                  size: 23
                }),
                _createElementVNode("span", null, "首页")
              ], 10, ["onClick"]),
              _createElementVNode("button", {
                class: _normalizeClass({ selected: _ctx.active === "ai" }),
                onClick: ($event) => _ctx.go("/ai"),
                "aria-label": "AI导购"
              }, [
                _createElementVNode("span", { class: "tiny-orb" }, [
                  _createVNode2(_component_Icon, {
                    name: "sparkles",
                    size: 20
                  })
                ]),
                _createElementVNode("span", null, "导购")
              ], 10, ["onClick"]),
              _createElementVNode("button", {
                class: _normalizeClass({ selected: _ctx.active === "cart" }),
                onClick: ($event) => _ctx.go("/cart")
              }, [
                _createVNode2(_component_Icon, {
                  name: "cart",
                  size: 23
                }),
                _createElementVNode("span", null, "购物车")
              ], 10, ["onClick"]),
              _createElementVNode("button", {
                class: _normalizeClass({ selected: _ctx.active === "orders" }),
                onClick: ($event) => _ctx.go("/orders")
              }, [
                _createVNode2(_component_Icon, {
                  name: "order",
                  size: 23
                }),
                _createElementVNode("span", null, "订单")
              ], 10, ["onClick"]),
              _createElementVNode("button", {
                class: _normalizeClass({ selected: _ctx.active === "account" }),
                onClick: ($event) => _ctx.go("/account")
              }, [
                _createVNode2(_component_Icon, {
                  name: "user",
                  size: 23
                }),
                _createElementVNode("span", null, "我的")
              ], 10, ["onClick"])
            ])
          ]),
          _ctx.loginOpen ? (_openBlock(), _createBlock(_component_AuthDialog, {
            key: 0,
            onClose: ($event) => _ctx.loginOpen = false
          }, null, 8, ["onClose"])) : _createCommentVNode("v-if", true)
        ]);
      };
    })()
  };
  const { computed: computed$g, ref: ref$g, watch: watch$d } = Vue;
  const ProductImage = {
    name: "ProductImage",
    props: {
      src: { type: String, default: "" },
      alt: { type: String, default: "商品图片" },
      loading: { type: String, default: "lazy" }
    },
    setup(props) {
      const broken = ref$g(false);
      watch$d(
        () => props.src,
        () => {
          broken.value = false;
        }
      );
      const url = computed$g(
        () => {
          var _a;
          return !broken.value && ((_a = props.src) == null ? void 0 : _a.trim()) ? props.src : "./images/product-placeholder.svg";
        }
      );
      function handleError2() {
        if (!broken.value) broken.value = true;
      }
      return { url, handleError: handleError2 };
    },
    render: (() => {
      const { openBlock: _openBlock, createElementBlock: _createElementBlock } = Vue;
      return function render2(_ctx, _cache) {
        return _openBlock(), _createElementBlock("img", {
          src: _ctx.url,
          alt: _ctx.alt,
          loading: _ctx.loading,
          onError: _ctx.handleError
        }, null, 40, ["src", "alt", "loading", "onError"]);
      };
    })()
  };
  const { ref: ref$f, computed: computed$f, onMounted: onMounted$c } = Vue;
  const staticCategoryArt = {
    food: "./images/category-snacks.webp",
    drink: "./images/category-drinks.webp",
    fruit: "./images/category-fruit.webp",
    stationery: "./images/category-stationery.webp",
    daily: "./images/category-daily.webp"
  };
  const Home = {
    name: "Home",
    components: { ConsumerShell, ProductImage },
    setup() {
      const scope = requestScope();
      const initialScope = requestScope();
      const keywords = ["泡面", "牛奶", "水果", "文具", "纸巾", "零食"];
      const search = ref$f("");
      const category = ref$f("");
      const merchant = ref$f("");
      const sort = ref$f("popular");
      const page = ref$f(1);
      const priceMin = ref$f("");
      const priceMax = ref$f("");
      const appliedMin = ref$f(null);
      const appliedMax = ref$f(null);
      const priceError = ref$f("");
      const selected = ref$f(null);
      const chosenSku = ref$f("");
      const count = ref$f(1);
      const saving = ref$f(false);
      const categories = computed$f(() => store.categories.filter((c) => c.active).slice(0, 5));
      const shops = computed$f(() => store.merchants.filter((m) => m.status === "ACTIVE").slice(0, 3));
      const shown = computed$f(() => {
        let arr = store.products.filter((p2) => p2.status === "PUBLISHED");
        if (preview) {
          const q = search.value.trim().toLowerCase();
          if (q) arr = arr.filter((p2) => (p2.title + " " + p2.description).toLowerCase().includes(q));
        }
        if (category.value) arr = arr.filter((p2) => p2.categoryCode === category.value);
        if (merchant.value) arr = arr.filter((p2) => p2.merchantId === merchant.value);
        if (preview && (appliedMin.value != null || appliedMax.value != null))
          arr = arr.filter(
            (p2) => (p2.skus || []).some(
              (s) => s.status === "ACTIVE" && (appliedMin.value == null || Number(s.priceCent) >= appliedMin.value) && (appliedMax.value == null || Number(s.priceCent) <= appliedMax.value)
            )
          );
        if (preview && sort.value === "price")
          arr = [...arr].sort(
            (a, b) => Number(priceSku(a).priceCent) - Number(priceSku(b).priceCent)
          );
        if (preview && sort.value === "stock")
          arr = [...arr].sort((a, b) => available(b) - available(a));
        return arr;
      });
      onMounted$c(() => loadPublic({ signal: initialScope.begin().signal }));
      const pageInfo = computed$f(() => store.publicPage);
      const priceActive = computed$f(() => appliedMin.value != null || appliedMax.value != null);
      const chosen = computed$f(
        () => {
          var _a, _b;
          return ((_b = (_a = selected.value) == null ? void 0 : _a.skus) == null ? void 0 : _b.find((s) => s.skuId === chosenSku.value)) || skuOf(selected.value);
        }
      );
      const productCategory = (p2) => {
        var _a;
        return ((_a = store.categories.find((c) => c.code === p2.categoryCode)) == null ? void 0 : _a.name) || "好物";
      };
      const currentShop = (p2) => store.merchants.find((m) => m.merchantId === p2.merchantId) || {};
      async function loadSearch() {
        if (preview) return;
        const request2 = scope.begin();
        const current = request2.current;
        const stamp = beginPublicSearch();
        const params = {
          q: search.value,
          category: category.value,
          merchantId: merchant.value,
          minPriceCent: appliedMin.value,
          maxPriceCent: appliedMax.value,
          page: page.value,
          size: 20,
          sort: sort.value === "price" ? "PRICE_ASC" : sort.value === "stock" ? "STOCK_DESC" : "NEWEST"
        };
        store.loading = true;
        store.error = "";
        try {
          const result = await api("/products/page" + query(params), { signal: request2.signal });
          if (!(current() && publicSearchCurrent(stamp))) return;
          store.products = result.items || [];
          store.publicPage = {
            page: result.page,
            size: result.size,
            total: result.total,
            hasNext: result.hasNext
          };
        } catch (err) {
          if (current() && publicSearchCurrent(stamp)) store.error = err.message;
        } finally {
          if (current() && publicSearchCurrent(stamp)) store.loading = false;
        }
      }
      function setCategory(c) {
        category.value = category.value === c ? "" : c;
        page.value = 1;
        loadSearch();
      }
      function applyKeyword(word) {
        search.value = word;
        page.value = 1;
        loadSearch();
      }
      function cardSku(p2) {
        const active = ((p2 == null ? void 0 : p2.skus) || []).filter((s) => s.status === "ACTIVE");
        const matched = active.filter(
          (s) => (appliedMin.value == null || Number(s.priceCent) >= appliedMin.value) && (appliedMax.value == null || Number(s.priceCent) <= appliedMax.value)
        );
        return (matched.length ? matched : active).sort(
          (a, b) => Number(a.priceCent) - Number(b.priceCent)
        )[0] || priceSku(p2);
      }
      function yuanToCent(raw) {
        const text = String(raw ?? "").trim();
        if (!text) return null;
        if (!/^\d+(\.\d{1,2})?$/.test(text)) return NaN;
        const [whole, fraction = ""] = text.split(".");
        if (whole.length > 9) return NaN;
        return Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
      }
      function applyPrice() {
        const min = yuanToCent(priceMin.value);
        const max = yuanToCent(priceMax.value);
        if (Number.isNaN(min) || Number.isNaN(max)) {
          priceError.value = "价格条件无效：请填写非负金额，最多两位小数";
          return;
        }
        if (min != null && max != null && min > max) {
          priceError.value = "价格条件无效：最低价不能高于最高价";
          return;
        }
        priceError.value = "";
        appliedMin.value = min;
        appliedMax.value = max;
        page.value = 1;
        loadSearch();
      }
      function clearPrice() {
        priceMin.value = "";
        priceMax.value = "";
        appliedMin.value = null;
        appliedMax.value = null;
        priceError.value = "";
        page.value = 1;
        loadSearch();
      }
      function resetFilters() {
        search.value = "";
        category.value = "";
        merchant.value = "";
        sort.value = "popular";
        priceMin.value = "";
        priceMax.value = "";
        appliedMin.value = null;
        appliedMax.value = null;
        priceError.value = "";
        page.value = 1;
        loadSearch();
      }
      function showDetail(p2) {
        var _a, _b;
        selected.value = p2;
        chosenSku.value = ((_b = (_a = p2.skus) == null ? void 0 : _a.find((s) => s.status === "ACTIVE" && Number(s.available) > 0)) == null ? void 0 : _b.skuId) || "";
        count.value = 1;
      }
      const canAdd = computed$f(
        () => {
          var _a;
          return ((_a = chosen.value) == null ? void 0 : _a.status) === "ACTIVE" && positiveInt(count.value, 99) && Number(count.value) <= Number(chosen.value.available);
        }
      );
      async function addCart() {
        var _a;
        if (!selected.value || saving.value || previewGuard()) return;
        if (!((_a = chosen.value) == null ? void 0 : _a.skuId) || !canAdd.value) {
          notify("请选择有效规格及库存范围内的数量");
          return;
        }
        const valid = scope.capture(), productId = selected.value.productId, skuId = chosen.value.skuId, requested = Number(count.value);
        saving.value = true;
        try {
          const current = await api("/products/" + pathId(productId));
          const real = current.skus.find((s) => s.skuId === skuId);
          if (!real || real.status !== "ACTIVE" || Number(real.available) < requested)
            throw new Error("库存不足或商品不可售");
          if (!valid()) return;
          await api("/cart", { method: "POST", body: { skuId: real.skuId, quantity: requested } });
          if (!valid()) return;
          selected.value = null;
          notify("已加入购物车");
        } catch (err) {
          if (valid()) notify(err.status === 401 ? "请先登录后再加购" : err.message);
        } finally {
          if (valid()) saving.value = false;
        }
      }
      return {
        store,
        pathId,
        go,
        money,
        skuOf,
        priceSku,
        available,
        shopName,
        preview,
        keywords,
        search,
        category,
        merchant,
        sort,
        page,
        priceMin,
        priceMax,
        priceActive,
        priceError,
        pageInfo,
        categories,
        shops,
        shown,
        selected,
        chosen,
        chosenSku,
        count,
        saving,
        canAdd,
        cardSku,
        productCategory,
        currentShop,
        staticCategoryArt,
        loadSearch,
        setCategory,
        applyKeyword,
        applyPrice,
        clearPrice,
        resetFilters,
        showDetail,
        addCart
      };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode2, vModelText: _vModelText, withKeys: _withKeys, createElementVNode: _createElementVNode, withDirectives: _withDirectives, renderList: _renderList, Fragment: _Fragment, openBlock: _openBlock, createElementBlock: _createElementBlock, toDisplayString: _toDisplayString, normalizeClass: _normalizeClass, createCommentVNode: _createCommentVNode, createTextVNode: _createTextVNode, createBlock: _createBlock, withModifiers: _withModifiers, resolveDirective: _resolveDirective, withCtx: _withCtx } = Vue;
      return function render2(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_ConsumerShell = _resolveComponent("ConsumerShell");
        const _directive_modal = _resolveDirective("modal");
        return _openBlock(), _createBlock(_component_ConsumerShell, { active: "home" }, {
          default: _withCtx(() => [
            _createElementVNode("section", { class: "search-section" }, [
              _createElementVNode("div", { class: "big-search" }, [
                _createVNode2(_component_Icon, {
                  name: "search",
                  size: 22
                }),
                _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": ($event) => _ctx.search = $event,
                  placeholder: "搜索商品、商户名称、规格",
                  "aria-label": "搜索校园商品",
                  onKeydown: _withKeys(($event) => {
                    _ctx.page = 1;
                    _ctx.loadSearch();
                  }, ["enter"])
                }, null, 40, ["onUpdate:modelValue", "onKeydown"]), [
                  [_vModelText, _ctx.search]
                ]),
                _createElementVNode("button", {
                  onClick: ($event) => {
                    _ctx.page = 1;
                    _ctx.loadSearch();
                  }
                }, "搜索", 8, ["onClick"])
              ]),
              _createElementVNode("div", { class: "popular-tags" }, [
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.keywords, (k) => {
                    return _openBlock(), _createElementBlock("button", {
                      key: k,
                      onClick: ($event) => _ctx.applyKeyword(k),
                      class: _normalizeClass({ active: _ctx.search === k })
                    }, _toDisplayString(k), 11, ["onClick"]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ]),
              _createElementVNode("div", {
                class: "price-filter",
                "aria-label": "价格筛选"
              }, [
                _createElementVNode("span", { class: "price-filter-label" }, "价格（元）"),
                _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": ($event) => _ctx.priceMin = $event,
                  inputmode: "decimal",
                  placeholder: "最低",
                  "aria-label": "最低价（元）",
                  onKeydown: _withKeys(_ctx.applyPrice, ["enter"])
                }, null, 40, ["onUpdate:modelValue", "onKeydown"]), [
                  [_vModelText, _ctx.priceMin]
                ]),
                _createElementVNode("span", null, "—"),
                _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": ($event) => _ctx.priceMax = $event,
                  inputmode: "decimal",
                  placeholder: "最高",
                  "aria-label": "最高价（元）",
                  onKeydown: _withKeys(_ctx.applyPrice, ["enter"])
                }, null, 40, ["onUpdate:modelValue", "onKeydown"]), [
                  [_vModelText, _ctx.priceMax]
                ]),
                _createElementVNode("button", {
                  class: "outline-button",
                  onClick: _ctx.applyPrice
                }, "应用", 8, ["onClick"]),
                _ctx.priceActive ? (_openBlock(), _createElementBlock("button", {
                  key: 0,
                  onClick: _ctx.clearPrice
                }, "清除价格", 8, ["onClick"])) : _createCommentVNode("v-if", true),
                _createElementVNode("button", {
                  class: "price-filter-reset",
                  onClick: _ctx.resetFilters
                }, "重置筛选", 8, ["onClick"])
              ]),
              _ctx.priceError ? (_openBlock(), _createElementBlock("div", {
                key: 0,
                class: "inline-error price-filter-error",
                role: "alert"
              }, [
                _createVNode2(_component_Icon, {
                  name: "alert",
                  size: 16
                }),
                _createTextVNode(
                  _toDisplayString(_ctx.priceError),
                  1
                  /* TEXT */
                )
              ])) : _createCommentVNode("v-if", true)
            ]),
            _createElementVNode("button", {
              class: "hero-shopping",
              onClick: ($event) => _ctx.go("/ai"),
              "aria-label": "进入 AI 导购"
            }, [
              _createElementVNode("div", { class: "hero-lines" }, [
                _createElementVNode("div", { class: "hero-title" }, [
                  _createElementVNode("span", null, "AI"),
                  _createTextVNode(" 导购")
                ]),
                _createElementVNode("h1", null, "你的校园购物小助手"),
                _createElementVNode("span", { class: "hero-cta" }, [
                  _createTextVNode("开始探索 "),
                  _createVNode2(_component_Icon, {
                    name: "arrowUpRight",
                    size: 17
                  })
                ])
              ]),
              _createElementVNode("div", { class: "hero-robot-wrap" }, [
                _createElementVNode("img", {
                  src: "./images/robot.webp",
                  alt: "AI 导购机器人"
                })
              ]),
              _createElementVNode("span", { class: "hero-star hstar-one" }, "✦"),
              _createElementVNode("span", { class: "hero-star hstar-two" }, "✧")
            ], 8, ["onClick"]),
            _createElementVNode("section", {
              class: "category-section",
              "aria-label": "商品分类"
            }, [
              (_openBlock(true), _createElementBlock(
                _Fragment,
                null,
                _renderList(_ctx.categories, (c) => {
                  return _openBlock(), _createElementBlock("button", {
                    key: c.code,
                    class: _normalizeClass(["category-item", { categoryActive: _ctx.category === c.code }]),
                    onClick: ($event) => _ctx.setCategory(c.code)
                  }, [
                    _createElementVNode("span", { class: "category-picture" }, [
                      _createElementVNode("img", {
                        src: _ctx.staticCategoryArt[c.code] || "./images/category-snacks.webp",
                        alt: c.name
                      }, null, 8, ["src", "alt"])
                    ]),
                    _createElementVNode(
                      "strong",
                      null,
                      _toDisplayString(c.name),
                      1
                      /* TEXT */
                    )
                  ], 10, ["onClick"]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ]),
            _createElementVNode("section", { class: "merchant-section" }, [
              _createElementVNode("div", { class: "section-head" }, [
                _createElementVNode("div", { class: "section-title" }, [
                  _createElementVNode("span", { class: "head-accent mint" }, [
                    _createVNode2(_component_Icon, {
                      name: "store",
                      size: 21
                    })
                  ]),
                  _createElementVNode("h2", null, "附近商家")
                ]),
                _createElementVNode("span", { class: "tiny-note" }, "校内自提")
              ]),
              _createElementVNode("div", { class: "merchant-cards" }, [
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.shops, (m, idx) => {
                    return _openBlock(), _createElementBlock("button", {
                      class: _normalizeClass(["merchant-card", { active: _ctx.merchant === m.merchantId }]),
                      key: m.merchantId,
                      onClick: ($event) => {
                        _ctx.merchant = m.merchantId;
                        _ctx.page = 1;
                        _ctx.loadSearch();
                      }
                    }, [
                      _createElementVNode(
                        "span",
                        {
                          class: _normalizeClass(["merchant-logo", "store-" + idx])
                        },
                        [
                          m.imageUrl ? (_openBlock(), _createElementBlock("img", {
                            key: 0,
                            src: m.imageUrl,
                            alt: m.name
                          }, null, 8, ["src", "alt"])) : (_openBlock(), _createBlock(_component_Icon, {
                            key: 1,
                            name: "store",
                            size: 21
                          }))
                        ],
                        2
                        /* CLASS */
                      ),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(m.name),
                        1
                        /* TEXT */
                      ),
                      _createElementVNode(
                        "small",
                        null,
                        _toDisplayString(m.storeName || m.location || "校内门店"),
                        1
                        /* TEXT */
                      ),
                      _createElementVNode("span", { class: "merchant-chip" }, [
                        _createElementVNode("span", { class: "merchant-chip-dot" }),
                        _createTextVNode(" 可自提")
                      ])
                    ], 10, ["onClick"]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ]),
              _ctx.merchant ? (_openBlock(), _createElementBlock("div", {
                key: 0,
                class: "merchant-filter-bar"
              }, [
                _createTextVNode(
                  "当前：" + _toDisplayString(_ctx.shopName(_ctx.merchant)),
                  1
                  /* TEXT */
                ),
                _createElementVNode("button", {
                  onClick: ($event) => {
                    _ctx.merchant = "";
                    _ctx.page = 1;
                    _ctx.loadSearch();
                  }
                }, [
                  _createTextVNode("清除筛选 "),
                  _createVNode2(_component_Icon, {
                    name: "x",
                    size: 13
                  })
                ], 8, ["onClick"])
              ])) : _createCommentVNode("v-if", true)
            ]),
            _createElementVNode("section", { class: "reco-section" }, [
              _createElementVNode("div", { class: "section-head reco-heading" }, [
                _createElementVNode("div", { class: "section-title" }, [
                  _createElementVNode("span", { class: "flame-icon" }, "✦"),
                  _createElementVNode("h2", null, "为你推荐")
                ]),
                _createElementVNode("div", { class: "sort-tabs" }, [
                  _createElementVNode("button", {
                    class: _normalizeClass({ active: _ctx.sort === "popular" }),
                    onClick: ($event) => {
                      _ctx.sort = "popular";
                      _ctx.page = 1;
                      _ctx.loadSearch();
                    }
                  }, "最新", 10, ["onClick"]),
                  _createElementVNode("button", {
                    class: _normalizeClass({ active: _ctx.sort === "stock" }),
                    onClick: ($event) => {
                      _ctx.sort = "stock";
                      _ctx.page = 1;
                      _ctx.loadSearch();
                    }
                  }, "全局库存", 10, ["onClick"]),
                  _createElementVNode("button", {
                    class: _normalizeClass({ active: _ctx.sort === "price" }),
                    onClick: ($event) => {
                      _ctx.sort = "price";
                      _ctx.page = 1;
                      _ctx.loadSearch();
                    }
                  }, "全局价格", 10, ["onClick"])
                ])
              ]),
              _ctx.store.loading ? (_openBlock(), _createElementBlock("div", {
                key: 0,
                class: "inline-loading"
              }, [
                _createElementVNode("div", { class: "mini-spinner" }),
                _createTextVNode("正在加载")
              ])) : _createCommentVNode("v-if", true),
              _ctx.store.error ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "inline-error"
              }, [
                _createVNode2(_component_Icon, {
                  name: "alert",
                  size: 18
                }),
                _createTextVNode(
                  _toDisplayString(_ctx.store.error) + " ",
                  1
                  /* TEXT */
                ),
                !_ctx.preview ? (_openBlock(), _createElementBlock("a", {
                  key: 0,
                  href: "/?demo=1#/"
                }, "查看设计预览")) : _createCommentVNode("v-if", true)
              ])) : _createCommentVNode("v-if", true),
              !_ctx.store.loading && !_ctx.shown.length && !_ctx.store.error ? (_openBlock(), _createElementBlock("div", {
                key: 2,
                class: "no-results"
              }, [
                _createVNode2(_component_Icon, {
                  name: "search",
                  size: 22
                }),
                _createTextVNode("暂无相关商品"),
                _createElementVNode("button", { onClick: _ctx.resetFilters }, "查看全部", 8, ["onClick"])
              ])) : _createCommentVNode("v-if", true),
              _createElementVNode("div", { class: "home-product-grid" }, [
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.shown, (p2) => {
                    var _a, _b;
                    return _openBlock(), _createElementBlock("article", {
                      class: "home-product",
                      key: p2.productId,
                      onClick: ($event) => _ctx.showDetail(p2)
                    }, [
                      _createElementVNode("div", { class: "home-product-photo" }, [
                        _createVNode2(_component_ProductImage, {
                          src: p2.imageUrl,
                          alt: p2.title
                        }, null, 8, ["src", "alt"]),
                        p2.tag ? (_openBlock(), _createElementBlock(
                          "span",
                          {
                            key: 0,
                            class: "corner-tag"
                          },
                          _toDisplayString(p2.tag),
                          1
                          /* TEXT */
                        )) : _createCommentVNode("v-if", true),
                        _createElementVNode("span", { class: "floating-pickup" }, "可自提")
                      ]),
                      _createElementVNode("div", { class: "home-product-info" }, [
                        _createElementVNode("button", {
                          class: "home-product-open",
                          onClick: _withModifiers(($event) => _ctx.showDetail(p2), ["stop"])
                        }, _toDisplayString(p2.title), 9, ["onClick"]),
                        _createElementVNode("div", { class: "product-minor" }, [
                          _createElementVNode(
                            "span",
                            null,
                            _toDisplayString(((_a = _ctx.cardSku(p2)) == null ? void 0 : _a.specKey) || "暂无规格"),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "span",
                            null,
                            "库存 " + _toDisplayString(_ctx.available(p2) > 0 ? "充足" : "售罄"),
                            1
                            /* TEXT */
                          )
                        ]),
                        _createElementVNode("div", { class: "product-price-row" }, [
                          _createElementVNode(
                            "span",
                            { class: "price-main" },
                            _toDisplayString(_ctx.money((_b = _ctx.cardSku(p2)) == null ? void 0 : _b.priceCent)) + " 起",
                            1
                            /* TEXT */
                          ),
                          _createElementVNode("button", {
                            onClick: _withModifiers(($event) => _ctx.showDetail(p2), ["stop"]),
                            "aria-label": "查看" + p2.title
                          }, [
                            _createVNode2(_component_Icon, {
                              name: "plus",
                              size: 20
                            })
                          ], 8, ["onClick", "aria-label"])
                        ])
                      ])
                    ], 8, ["onClick"]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ]),
              !_ctx.preview && _ctx.pageInfo.total > 0 ? (_openBlock(), _createElementBlock("div", {
                key: 3,
                class: "sdd-pager"
              }, [
                _createElementVNode(
                  "span",
                  null,
                  "共 " + _toDisplayString(_ctx.pageInfo.total) + " 件",
                  1
                  /* TEXT */
                ),
                _createElementVNode("button", {
                  disabled: _ctx.page <= 1 || _ctx.store.loading,
                  onClick: ($event) => {
                    _ctx.page--;
                    _ctx.loadSearch();
                  }
                }, "上一页", 8, ["disabled", "onClick"]),
                _createElementVNode(
                  "span",
                  null,
                  _toDisplayString(_ctx.page),
                  1
                  /* TEXT */
                ),
                _createElementVNode("button", {
                  disabled: !_ctx.pageInfo.hasNext || _ctx.store.loading,
                  onClick: ($event) => {
                    _ctx.page++;
                    _ctx.loadSearch();
                  }
                }, "下一页", 8, ["disabled", "onClick"])
              ])) : _createCommentVNode("v-if", true)
            ]),
            _ctx.selected ? _withDirectives((_openBlock(), _createElementBlock("div", {
              key: 0,
              class: "ui-overlay",
              onClick: _withModifiers(($event) => _ctx.selected = null, ["self"])
            }, [
              _createElementVNode("div", {
                class: "product-sheet",
                role: "dialog",
                "aria-modal": "true",
                "aria-label": _ctx.selected.title
              }, [
                _createElementVNode("button", {
                  class: "sheet-close",
                  onClick: ($event) => _ctx.selected = null,
                  "aria-label": "关闭"
                }, [
                  _createVNode2(_component_Icon, {
                    name: "x",
                    size: 19
                  })
                ], 8, ["onClick"]),
                _createElementVNode("div", { class: "sheet-product-line" }, [
                  _createVNode2(_component_ProductImage, {
                    src: _ctx.selected.imageUrl,
                    alt: _ctx.selected.title
                  }, null, 8, ["src", "alt"]),
                  _createElementVNode("div", null, [
                    _createElementVNode(
                      "span",
                      { class: "mini-category" },
                      _toDisplayString(_ctx.productCategory(_ctx.selected)),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode(
                      "h3",
                      null,
                      _toDisplayString(_ctx.selected.title),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode(
                      "div",
                      { class: "sheet-price" },
                      _toDisplayString(_ctx.money(_ctx.chosen.priceCent)),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode(
                      "span",
                      { class: "sheet-muted" },
                      _toDisplayString(_ctx.currentShop(_ctx.selected).name || "校内商户"),
                      1
                      /* TEXT */
                    )
                  ])
                ]),
                _createElementVNode("button", {
                  class: "more-product-detail",
                  onClick: ($event) => {
                    _ctx.go("/product/" + _ctx.pathId(_ctx.selected.productId));
                    _ctx.selected = null;
                  }
                }, [
                  _createTextVNode("查看商品详情 "),
                  _createVNode2(_component_Icon, {
                    name: "chevronRight",
                    size: 15
                  })
                ], 8, ["onClick"]),
                _createElementVNode("label", { class: "sheet-field-label" }, "选择规格"),
                _createElementVNode("div", { class: "sku-picker" }, [
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(_ctx.selected.skus, (sku2) => {
                      return _openBlock(), _createElementBlock("button", {
                        key: sku2.skuId,
                        class: _normalizeClass({ active: _ctx.chosenSku === sku2.skuId }),
                        "aria-pressed": _ctx.chosenSku === sku2.skuId,
                        disabled: _ctx.saving || sku2.status !== "ACTIVE" || Number(sku2.available) <= 0,
                        onClick: ($event) => {
                          _ctx.chosenSku = sku2.skuId;
                          _ctx.count = 1;
                        }
                      }, _toDisplayString(sku2.specKey), 11, ["aria-pressed", "disabled", "onClick"]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ]),
                _createElementVNode("div", { class: "quantity-picker" }, [
                  _createElementVNode("span", null, "购买数量"),
                  _createElementVNode("div", null, [
                    _createElementVNode("button", {
                      onClick: ($event) => _ctx.count = Math.max(1, _ctx.count - 1),
                      "aria-label": "减少数量",
                      disabled: _ctx.saving
                    }, [
                      _createVNode2(_component_Icon, {
                        name: "minus",
                        size: 17
                      })
                    ], 8, ["onClick", "disabled"]),
                    _createElementVNode(
                      "b",
                      null,
                      _toDisplayString(_ctx.count),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("button", {
                      onClick: ($event) => _ctx.count = Math.min(99, Number(_ctx.chosen.available || 0), _ctx.count + 1),
                      "aria-label": "增加数量",
                      disabled: _ctx.saving || _ctx.count >= Number(_ctx.chosen.available || 0)
                    }, [
                      _createVNode2(_component_Icon, {
                        name: "plus",
                        size: 17
                      })
                    ], 8, ["onClick", "disabled"])
                  ])
                ]),
                _createElementVNode("button", {
                  class: "primary-wide",
                  disabled: !_ctx.canAdd || _ctx.saving || _ctx.preview,
                  onClick: _ctx.addCart
                }, _toDisplayString(_ctx.saving ? "加入中…" : "加入购物车"), 9, ["disabled", "onClick"])
              ], 8, ["aria-label"])
            ], 8, ["onClick"])), [
              [_directive_modal, () => _ctx.selected = null]
            ]) : _createCommentVNode("v-if", true)
          ]),
          _: 1
          /* STABLE */
        });
      };
    })()
  };
  function citationsOf(answer) {
    return ((answer == null ? void 0 : answer.citations) ?? []).map((citation) => ({
      documentId: (citation == null ? void 0 : citation.documentId) || "",
      title: (citation == null ? void 0 : citation.title) || "",
      snippet: (citation == null ? void 0 : citation.snippet) || ""
    }));
  }
  const { ref: ref$e, computed: computed$e, onMounted: onMounted$b, onUnmounted: onUnmounted$8, watch: watch$c } = Vue;
  const prompts = [
    { label: "30元内夜宵", icon: "clock", query: "30元以内，推荐几样适合复习时吃的夜宵" },
    { label: "高蛋白零食", icon: "sparkles", query: "想买点高蛋白的零食，有什么推荐？" },
    { label: "复习清单", icon: "book", query: "帮我列一个考试周的购物清单" },
    { label: "找点好喝的", icon: "cart", query: "推荐适合夏天喝的饮料" }
  ];
  const Guide = {
    name: "Guide",
    components: { ConsumerShell, ProductImage },
    setup() {
      const input = ref$e("");
      const thinking = ref$e(false);
      const selectedIds = ref$e([]);
      const messages = ref$e([]);
      const proposal = ref$e(null);
      const mode = ref$e("");
      const error = ref$e("");
      const historyOpen = ref$e(false);
      const conversations = ref$e([]);
      const historyPage = ref$e(1);
      const historyHasMore = ref$e(false);
      const loadingHistory = ref$e(false);
      const openingConversation = ref$e(false);
      const confirmingProposal = ref$e(false);
      const proposalFeedback = ref$e("");
      const streamProgress = ref$e(0);
      const reconnecting = ref$e(false);
      const cancelRequested = ref$e(false);
      let conversationEpoch = 0, historyEpoch = 0, activeStreamController = null;
      const examples = computed$e(() => DEMO_PRODUCTS.slice(0, 3));
      const items2 = computed$e(
        () => {
          var _a;
          return preview ? examples.value.map((p2) => ({
            skuId: skuOf(p2).skuId,
            productId: p2.productId,
            product: p2,
            title: p2.title,
            specKey: skuOf(p2).specKey,
            priceCent: skuOf(p2).priceCent,
            quantity: 1,
            merchantId: p2.merchantId,
            detailAvailable: true
          })) : (((_a = proposal.value) == null ? void 0 : _a.items) || []).map((i) => ({ ...i }));
        }
      );
      const total = computed$e(
        () => items2.value.filter((i) => selectedIds.value.includes(i.skuId)).reduce((n, i) => n + Number(i.priceCent) * Number(i.quantity || 1), 0)
      );
      const showProposal = computed$e(() => {
        var _a, _b;
        return preview || !!((_b = (_a = proposal.value) == null ? void 0 : _a.items) == null ? void 0 : _b.length);
      });
      const formatTime = () => (/* @__PURE__ */ new Date()).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
      const formatHistoryTime = (value) => {
        if (!value) return "暂无时间";
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "暂无时间" : date.toLocaleString("zh-CN", {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        });
      };
      watch$c(
        () => {
          var _a;
          return (_a = store.user) == null ? void 0 : _a.userId;
        },
        (now, was) => {
          if (preview || now === was) return;
          stopActiveStream();
          ++conversationEpoch;
          ++historyEpoch;
          store.conversationId = "";
          messages.value = [];
          conversations.value = [];
          historyPage.value = 1;
          historyHasMore.value = false;
          proposal.value = null;
          selectedIds.value = [];
          proposalFeedback.value = "";
          mode.value = "";
          error.value = "";
          input.value = "";
          thinking.value = false;
          confirmingProposal.value = false;
          openingConversation.value = false;
          loadingHistory.value = false;
          historyOpen.value = false;
          if (now) loadHistory();
        }
      );
      onMounted$b(() => {
        if (!preview) loadHistory();
        if (preview) {
          messages.value = DEMO_CHAT.map((m) => ({ ...m, time: "20:14" }));
          selectedIds.value = examples.value.map((p2) => skuOf(p2).skuId);
        }
      });
      function stopActiveStream() {
        activeStreamController == null ? void 0 : activeStreamController.abort();
        activeStreamController = null;
      }
      function applyChatAnswer(answer, stamp) {
        var _a;
        if (stamp !== conversationEpoch || !answer) return;
        store.conversationId = answer.conversationId || store.conversationId;
        mode.value = answer.mode || "";
        messages.value.push({
          role: "assistant",
          content: answer.answer || "暂时没有找到合适答案",
          warning: answer.warning,
          citations: citationsOf(answer),
          time: formatTime()
        });
        proposal.value = answer.proposal || null;
        selectedIds.value = (((_a = proposal.value) == null ? void 0 : _a.items) || []).map((i) => i.skuId);
        proposalFeedback.value = "";
      }
      async function loadConversationSnapshot(id, stamp) {
        var _a;
        const encoded = encodeURIComponent(id);
        const [history, proposals] = await Promise.all([
          api("/ai/conversations/" + encoded + "/messages"),
          api("/ai/conversations/" + encoded + "/proposals")
        ]);
        if (stamp !== conversationEpoch) return false;
        store.conversationId = id;
        messages.value = (history || []).map((m) => ({
          role: m.role,
          content: m.content,
          citations: citationsOf(m),
          citationStatus: m.citationStatus || "MISSING",
          time: "历史消息"
        }));
        proposal.value = (proposals || []).find((p2) => p2.status === "PENDING") || null;
        selectedIds.value = (((_a = proposal.value) == null ? void 0 : _a.items) || []).map((i) => i.skuId);
        return true;
      }
      async function recoverAfterDisconnect(stamp, actor, id) {
        var _a, _b;
        if (!id || actor !== ((_a = store.user) == null ? void 0 : _a.userId)) return false;
        reconnecting.value = true;
        try {
          for (let attempt = 0; attempt < 10; attempt += 1) {
            if (stamp !== conversationEpoch || actor !== ((_b = store.user) == null ? void 0 : _b.userId)) return true;
            const status = await api("/ai/conversations/" + encodeURIComponent(id) + "/turn/status", {
              timeoutMs: 5e3
            });
            if ((status == null ? void 0 : status.status) === "CANCEL_REQUESTED") {
              cancelRequested.value = true;
              return true;
            }
            if ((status == null ? void 0 : status.status) === "IDLE") return loadConversationSnapshot(id, stamp);
            await new Promise((resolve2) => setTimeout(resolve2, 500));
          }
        } finally {
          reconnecting.value = false;
        }
        return false;
      }
      async function cancelTurn() {
        const id = store.conversationId;
        if (preview || !thinking.value || !id || cancelRequested.value) return;
        cancelRequested.value = true;
        try {
          await api("/ai/conversations/" + encodeURIComponent(id) + "/turn/cancel", {
            method: "POST"
          });
        } catch (err) {
          cancelRequested.value = false;
          notify((err == null ? void 0 : err.message) || "取消请求未完成，请稍后重试");
        }
      }
      async function ask(question = input.value) {
        var _a;
        const text = String(question || "").trim();
        if (!text || thinking.value || openingConversation.value) return;
        if (text.length > 500) {
          notify("问题不能超过500字");
          return;
        }
        const stamp = ++conversationEpoch;
        input.value = "";
        error.value = "";
        proposalFeedback.value = "";
        messages.value.push({ role: "user", content: text, time: formatTime() });
        if (preview) {
          messages.value.push({
            role: "assistant",
            content: "为你挑了几款商品，看看有没有喜欢的。",
            time: formatTime(),
            demo: true
          });
          notify("设计预览 · 未请求真实 AI");
          return;
        }
        thinking.value = true;
        streamProgress.value = 0;
        reconnecting.value = false;
        cancelRequested.value = false;
        activeStreamController = new AbortController();
        const controller = activeStreamController;
        const actor = (_a = store.user) == null ? void 0 : _a.userId;
        let streamConversationId = store.conversationId || null;
        let completed = false;
        let cancelled = false;
        try {
          await stream("/ai/chat/stream", {
            signal: controller.signal,
            body: { question: text, conversationId: store.conversationId || null },
            onEvent: async (event, payload) => {
              var _a2, _b, _c;
              if (stamp !== conversationEpoch) return;
              const id = (payload == null ? void 0 : payload.conversationId) || ((_a2 = payload == null ? void 0 : payload.data) == null ? void 0 : _a2.conversationId);
              if (id) {
                streamConversationId = id;
                store.conversationId = id;
              }
              if (event === "progress") {
                streamProgress.value = Number(((_b = payload == null ? void 0 : payload.data) == null ? void 0 : _b.bytes) || (payload == null ? void 0 : payload.bytes) || 0);
              } else if (event === "completed") {
                completed = true;
                applyChatAnswer(payload == null ? void 0 : payload.data, stamp);
              } else if (event === "cancelled") {
                cancelled = true;
                cancelRequested.value = true;
              } else if (event === "failed") {
                const code = (payload == null ? void 0 : payload.errorCode) || ((_c = payload == null ? void 0 : payload.data) == null ? void 0 : _c.errorCode) || "AI0001";
                throw Object.assign(new Error("智能服务暂不可用，请稍后重试"), { code });
              }
            }
          });
          if (!completed && !cancelled)
            throw Object.assign(new Error("流式响应未完成"), { code: "RESPONSE" });
        } catch (err) {
          if ((err == null ? void 0 : err.name) === "AbortError" && (cancelRequested.value || stamp !== conversationEpoch))
            return;
          if ((err == null ? void 0 : err.code) === "NETWORK" && streamConversationId) {
            const recovered = await recoverAfterDisconnect(stamp, actor, streamConversationId);
            if (recovered) return;
          }
          if (stamp === conversationEpoch && !cancelled) {
            error.value = err.status === 401 ? "请先登录账号再使用 AI 导购" : err.message;
            messages.value.pop();
            input.value = text;
          }
        } finally {
          if (activeStreamController === controller) activeStreamController = null;
          if (stamp === conversationEpoch) thinking.value = false;
        }
      }
      async function loadHistory(reset = true) {
        if (preview) return;
        if (loadingHistory.value && !reset) return;
        const stamp = ++historyEpoch;
        const page = reset ? 1 : historyPage.value + 1;
        loadingHistory.value = true;
        try {
          const result = await api("/ai/conversations" + query({ page, size: 20 })) || [];
          if (stamp === historyEpoch) {
            conversations.value = reset ? result : [...new Map([...conversations.value, ...result].map((c) => [c.id, c])).values()];
            historyPage.value = page;
            historyHasMore.value = result.length === 20;
          }
        } catch {
          if (stamp === historyEpoch && reset) conversations.value = [];
        } finally {
          if (stamp === historyEpoch) loadingHistory.value = false;
        }
      }
      async function openConversation(c) {
        if (preview || thinking.value || !(c == null ? void 0 : c.id)) return;
        const stamp = ++conversationEpoch;
        openingConversation.value = true;
        try {
          await loadConversationSnapshot(c.id, stamp);
          proposalFeedback.value = "";
          historyOpen.value = false;
        } catch (e) {
          if (stamp === conversationEpoch) notify(e.message);
        } finally {
          if (stamp === conversationEpoch) openingConversation.value = false;
        }
      }
      function newConversation() {
        if (confirmingProposal.value) return;
        stopActiveStream();
        ++conversationEpoch;
        store.conversationId = "";
        messages.value = [];
        proposal.value = null;
        selectedIds.value = [];
        proposalFeedback.value = "";
        mode.value = "";
        error.value = "";
        input.value = "";
        thinking.value = false;
        openingConversation.value = false;
        historyOpen.value = false;
      }
      onUnmounted$8(() => {
        stopActiveStream();
        ++conversationEpoch;
        ++historyEpoch;
      });
      function toggle(id) {
        if (selectedIds.value.includes(id))
          selectedIds.value = selectedIds.value.filter((x) => x !== id);
        else selectedIds.value = [...selectedIds.value, id];
      }
      function openDetail(item) {
        if (preview) {
          if (item == null ? void 0 : item.productId) go("/product/" + encodeURIComponent(item.productId));
          return;
        }
        if (!(item == null ? void 0 : item.detailAvailable) || !(item == null ? void 0 : item.productId)) {
          notify("该商品详情暂不可用，请重新咨询");
          return;
        }
        go("/product/" + encodeURIComponent(item.productId));
      }
      function proposalFailureMessage(err) {
        const messages2 = {
          AI0002: "这份推荐已过期，请重新咨询后再选择商品。",
          C0001: "其中商品已下架或暂不可售，请重新咨询后选择。",
          C0002: "商品价格或版本已变化，请重新查看推荐后确认。",
          I0001: "其中商品库存不足，请调整选择或重新咨询。",
          G0002: "这份推荐状态已变化，请重新打开会话后再试。",
          G0003: "这份推荐已经用另一组选择确认，不能更换选择重复加购。",
          NETWORK: "确认请求未完成，请稍后用相同选择重试。",
          TIMEOUT: "确认结果暂时未知，请稍后用相同选择重试。"
        };
        return messages2[err == null ? void 0 : err.code] || (err == null ? void 0 : err.message) || "确认加购失败，请保留选择后重试。";
      }
      function currentProposal(stamp, actor, proposalId) {
        var _a, _b;
        return stamp === conversationEpoch && actor === ((_a = store.user) == null ? void 0 : _a.userId) && ((_b = proposal.value) == null ? void 0 : _b.id) === proposalId;
      }
      function currentRequest(stamp, actor) {
        var _a;
        return stamp === conversationEpoch && actor === ((_a = store.user) == null ? void 0 : _a.userId);
      }
      async function confirm() {
        var _a, _b;
        if (previewGuard() || !((_a = proposal.value) == null ? void 0 : _a.id) || thinking.value) return;
        const stamp = conversationEpoch, actor = (_b = store.user) == null ? void 0 : _b.userId, proposalId = proposal.value.id, chosen = [...selectedIds.value];
        if (!selectedIds.value.length) {
          notify("至少选择一件商品");
          return;
        }
        proposalFeedback.value = "";
        thinking.value = true;
        confirmingProposal.value = true;
        try {
          const updated = await api("/ai/proposals/" + encodeURIComponent(proposalId) + "/confirm", {
            method: "POST",
            body: { selectedSkuIds: chosen }
          });
          if (currentProposal(stamp, actor, proposalId)) {
            proposal.value = updated;
            selectedIds.value = chosen;
            notify("已确认提案，购物车已更新");
          }
        } catch (err) {
          if (currentProposal(stamp, actor, proposalId)) {
            proposalFeedback.value = proposalFailureMessage(err);
            notify(proposalFeedback.value);
          }
        } finally {
          if (currentProposal(stamp, actor, proposalId)) {
            thinking.value = false;
            confirmingProposal.value = false;
          }
        }
      }
      async function reject() {
        var _a, _b;
        if (previewGuard() || !((_a = proposal.value) == null ? void 0 : _a.id) || thinking.value) return;
        const stamp = conversationEpoch, actor = (_b = store.user) == null ? void 0 : _b.userId, proposalId = proposal.value.id;
        proposalFeedback.value = "";
        thinking.value = true;
        try {
          await api("/ai/proposals/" + encodeURIComponent(proposalId) + "/reject", {
            method: "POST"
          });
          if (currentProposal(stamp, actor, proposalId)) {
            proposal.value = null;
            notify("已放弃提案");
          }
        } catch (err) {
          if (currentProposal(stamp, actor, proposalId)) {
            proposalFeedback.value = (err == null ? void 0 : err.message) || "放弃提案失败，请稍后重试。";
            notify(proposalFeedback.value);
          }
        } finally {
          if (currentRequest(stamp, actor)) thinking.value = false;
        }
      }
      return {
        store,
        go,
        money,
        skuOf,
        preview,
        prompts,
        messages,
        input,
        thinking,
        items: items2,
        selectedIds,
        total,
        showProposal,
        proposal,
        error,
        mode,
        ask,
        toggle,
        openDetail,
        confirm,
        reject,
        historyOpen,
        conversations,
        formatHistoryTime,
        historyHasMore,
        loadingHistory,
        openingConversation,
        confirmingProposal,
        proposalFeedback,
        streamProgress,
        reconnecting,
        cancelRequested,
        cancelTurn,
        loadHistory,
        openConversation,
        newConversation
      };
    },
    render: (() => {
      const { createElementVNode: _createElementVNode, createTextVNode: _createTextVNode, resolveComponent: _resolveComponent, createVNode: _createVNode2, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, renderList: _renderList, Fragment: _Fragment, toDisplayString: _toDisplayString, normalizeClass: _normalizeClass, vModelText: _vModelText, withDirectives: _withDirectives, withModifiers: _withModifiers, withCtx: _withCtx, createBlock: _createBlock } = Vue;
      return function render2(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_ConsumerShell = _resolveComponent("ConsumerShell");
        return _openBlock(), _createBlock(_component_ConsumerShell, { active: "ai" }, {
          default: _withCtx(() => {
            var _a, _b, _c;
            return [
              _createElementVNode("section", { class: "ai-hero" }, [
                _createElementVNode("div", { class: "ai-hero-text" }, [
                  _createElementVNode("h1", null, [
                    _createElementVNode("span", null, "AI"),
                    _createTextVNode(" 导购助手")
                  ]),
                  _createElementVNode("p", null, "想买什么？问我就好。")
                ]),
                _createElementVNode("img", {
                  src: "./images/robot.webp",
                  alt: "AI 导购机器人",
                  class: "ai-hero-robot"
                }),
                _createElementVNode("span", { class: "orb-decoration orb-one" }, "✦"),
                _createElementVNode("span", { class: "orb-decoration orb-two" }, "✧")
              ]),
              !_ctx.preview ? (_openBlock(), _createElementBlock("div", {
                key: 0,
                class: "ai-history-head"
              }, [
                _createElementVNode("button", {
                  class: "ai-new-chat",
                  onClick: _ctx.newConversation,
                  disabled: _ctx.openingConversation || _ctx.confirmingProposal
                }, [
                  _createVNode2(_component_Icon, {
                    name: "plus",
                    size: 15
                  }),
                  _createTextVNode(" 新对话")
                ], 8, ["onClick", "disabled"]),
                _createElementVNode("button", {
                  onClick: ($event) => {
                    _ctx.historyOpen = !_ctx.historyOpen;
                    _ctx.historyOpen && _ctx.loadHistory();
                  }
                }, [
                  _createVNode2(_component_Icon, {
                    name: "clock",
                    size: 15
                  }),
                  _createTextVNode(" 历史会话 "),
                  _createVNode2(_component_Icon, {
                    name: "chevronDown",
                    size: 14
                  })
                ], 8, ["onClick"])
              ])) : _createCommentVNode("v-if", true),
              _ctx.historyOpen ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "ai-history-list"
              }, [
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.conversations, (c) => {
                    return _openBlock(), _createElementBlock("button", {
                      key: c.id,
                      onClick: ($event) => _ctx.openConversation(c),
                      disabled: _ctx.thinking || _ctx.openingConversation
                    }, [
                      _createVNode2(_component_Icon, {
                        name: "order",
                        size: 16
                      }),
                      _createTextVNode(),
                      _createElementVNode("span", { class: "ai-history-copy" }, [
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(c.summary || c.title || "对话"),
                          1
                          /* TEXT */
                        ),
                        _createElementVNode(
                          "small",
                          null,
                          _toDisplayString(_ctx.formatHistoryTime(c.lastActiveAt || c.createdAt)),
                          1
                          /* TEXT */
                        )
                      ]),
                      _createTextVNode(),
                      _createVNode2(_component_Icon, {
                        name: "chevronRight",
                        size: 14
                      })
                    ], 8, ["onClick", "disabled"]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                )),
                !_ctx.conversations.length ? (_openBlock(), _createElementBlock("span", { key: 0 }, "暂无历史记录")) : _createCommentVNode("v-if", true),
                _ctx.historyHasMore ? (_openBlock(), _createElementBlock("button", {
                  key: 1,
                  onClick: ($event) => _ctx.loadHistory(false),
                  disabled: _ctx.loadingHistory
                }, "加载更多会话", 8, ["onClick", "disabled"])) : _createCommentVNode("v-if", true)
              ])) : _createCommentVNode("v-if", true),
              _createElementVNode("div", {
                class: "quick-prompts",
                "aria-label": "快捷提问"
              }, [
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.prompts, (p2) => {
                    return _openBlock(), _createElementBlock("button", {
                      key: p2.label,
                      onClick: ($event) => _ctx.ask(p2.query),
                      disabled: _ctx.thinking || _ctx.openingConversation
                    }, [
                      _createVNode2(_component_Icon, {
                        name: p2.icon,
                        size: 15
                      }, null, 8, ["name"]),
                      _createTextVNode(
                        _toDisplayString(p2.label),
                        1
                        /* TEXT */
                      )
                    ], 8, ["onClick", "disabled"]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ]),
              _createElementVNode("section", {
                class: "chat-thread",
                "aria-label": "AI对话"
              }, [
                !_ctx.messages.length ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "chat-welcome"
                }, [
                  _createElementVNode("span", { class: "chat-welcome-icon" }, [
                    _createVNode2(_component_Icon, {
                      name: "sparkles",
                      size: 22
                    })
                  ]),
                  _createElementVNode("h2", null, "你好，同学。"),
                  _createElementVNode("p", null, "告诉我预算或想买的东西。")
                ])) : _createCommentVNode("v-if", true),
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.messages, (message, index) => {
                    var _a2;
                    return _openBlock(), _createElementBlock(
                      "div",
                      {
                        class: _normalizeClass(["chat-row", message.role === "user" ? "is-user" : "is-assistant"]),
                        key: index
                      },
                      [
                        message.role !== "user" ? (_openBlock(), _createElementBlock("span", {
                          key: 0,
                          class: "chat-avatar"
                        }, [
                          _createElementVNode("img", {
                            src: "./images/robot.webp",
                            alt: "AI"
                          })
                        ])) : _createCommentVNode("v-if", true),
                        _createElementVNode("div", { class: "chat-body" }, [
                          _createElementVNode(
                            "div",
                            { class: "chat-bubble" },
                            _toDisplayString(message.content),
                            1
                            /* TEXT */
                          ),
                          message.warning ? (_openBlock(), _createElementBlock(
                            "div",
                            {
                              key: 0,
                              class: "message-warning"
                            },
                            _toDisplayString(message.warning),
                            1
                            /* TEXT */
                          )) : _createCommentVNode("v-if", true),
                          ((_a2 = message.citations) == null ? void 0 : _a2.length) ? (_openBlock(), _createElementBlock("div", {
                            key: 1,
                            class: "citation-chips"
                          }, [
                            (_openBlock(true), _createElementBlock(
                              _Fragment,
                              null,
                              _renderList(message.citations, (c, ci) => {
                                return _openBlock(), _createElementBlock("details", {
                                  class: "citation-chip",
                                  key: c.documentId || ci
                                }, [
                                  _createElementVNode("summary", null, [
                                    _createVNode2(_component_Icon, {
                                      name: "book",
                                      size: 12
                                    }),
                                    _createTextVNode(
                                      _toDisplayString(c.title || "参考资料"),
                                      1
                                      /* TEXT */
                                    )
                                  ]),
                                  c.snippet ? (_openBlock(), _createElementBlock(
                                    "p",
                                    { key: 0 },
                                    _toDisplayString(c.snippet),
                                    1
                                    /* TEXT */
                                  )) : _createCommentVNode("v-if", true)
                                ]);
                              }),
                              128
                              /* KEYED_FRAGMENT */
                            ))
                          ])) : _createCommentVNode("v-if", true),
                          message.role === "assistant" && message.citationStatus === "MISSING" ? (_openBlock(), _createElementBlock("div", {
                            key: 2,
                            class: "message-warning"
                          }, "历史消息没有可恢复的引用记录")) : _createCommentVNode("v-if", true),
                          message.role === "assistant" && message.citationStatus === "HIDDEN" ? (_openBlock(), _createElementBlock("div", {
                            key: 3,
                            class: "message-warning"
                          }, "当前无法核验这条历史引用，来源已隐藏")) : _createCommentVNode("v-if", true),
                          _createElementVNode("span", { class: "chat-timestamp" }, [
                            _createTextVNode(
                              _toDisplayString(message.time || "刚刚") + " ",
                              1
                              /* TEXT */
                            ),
                            message.demo ? (_openBlock(), _createElementBlock("span", { key: 0 }, "· 示例回答")) : _createCommentVNode("v-if", true)
                          ])
                        ])
                      ],
                      2
                      /* CLASS */
                    );
                  }),
                  128
                  /* KEYED_FRAGMENT */
                )),
                _ctx.thinking ? (_openBlock(), _createElementBlock("div", {
                  key: 1,
                  class: "chat-row is-assistant"
                }, [
                  _createElementVNode("span", { class: "chat-avatar" }, [
                    _createElementVNode("img", {
                      src: "./images/robot.webp",
                      alt: "AI"
                    })
                  ]),
                  _createElementVNode("div", { class: "typing-bubble" }, [
                    _createElementVNode("i"),
                    _createElementVNode("i"),
                    _createElementVNode("i"),
                    _ctx.reconnecting ? (_openBlock(), _createElementBlock("small", { key: 0 }, "连接已断开，正在恢复原会话…")) : _ctx.cancelRequested ? (_openBlock(), _createElementBlock("small", { key: 1 }, "正在停止本轮生成…")) : _ctx.streamProgress ? (_openBlock(), _createElementBlock(
                      "small",
                      { key: 2 },
                      "已读取 " + _toDisplayString(_ctx.streamProgress) + " 字节",
                      1
                      /* TEXT */
                    )) : _createCommentVNode("v-if", true)
                  ])
                ])) : _createCommentVNode("v-if", true),
                _ctx.error ? (_openBlock(), _createElementBlock("div", {
                  key: 2,
                  class: "inline-error"
                }, [
                  _createVNode2(_component_Icon, {
                    name: "alert",
                    size: 17
                  }),
                  _createTextVNode(
                    _toDisplayString(_ctx.error),
                    1
                    /* TEXT */
                  )
                ])) : _createCommentVNode("v-if", true)
              ]),
              _ctx.showProposal ? (_openBlock(), _createElementBlock("section", {
                key: 2,
                class: "recommendation-panel"
              }, [
                _createElementVNode("div", { class: "recommendation-header" }, [
                  _createElementVNode("div", null, [
                    _createElementVNode("h2", null, [
                      _createTextVNode("为你选了 "),
                      _createElementVNode(
                        "em",
                        null,
                        _toDisplayString(_ctx.items.length),
                        1
                        /* TEXT */
                      ),
                      _createTextVNode(" 件好物")
                    ])
                  ])
                ]),
                _createElementVNode("div", { class: "rec-cards" }, [
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(_ctx.items, (item, index) => {
                      var _a2;
                      return _openBlock(), _createElementBlock("article", {
                        class: "rec-item",
                        key: item.skuId
                      }, [
                        _createElementVNode("button", {
                          class: _normalizeClass(["rec-check", { checked: _ctx.selectedIds.includes(item.skuId) }]),
                          onClick: ($event) => _ctx.toggle(item.skuId),
                          "aria-label": "选择" + item.title
                        }, [
                          _createVNode2(_component_Icon, {
                            name: "check",
                            size: 13
                          })
                        ], 10, ["onClick", "aria-label"]),
                        _createElementVNode("div", { class: "rec-photo" }, [
                          _createVNode2(_component_ProductImage, {
                            src: item.imageUrl || ((_a2 = item.product) == null ? void 0 : _a2.imageUrl),
                            alt: item.title
                          }, null, 8, ["src", "alt"])
                        ]),
                        _createElementVNode("div", { class: "rec-card-content" }, [
                          _createElementVNode(
                            "div",
                            { class: "rec-item-tag" },
                            _toDisplayString(index === 0 ? "HOT PICK" : index === 1 ? "DAILY" : "GOOD VALUE"),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "strong",
                            null,
                            _toDisplayString(item.title),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "small",
                            null,
                            _toDisplayString(item.specKey),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode("button", {
                            class: "rec-detail-link",
                            type: "button",
                            onClick: ($event) => _ctx.openDetail(item),
                            disabled: !item.detailAvailable || !item.productId
                          }, _toDisplayString(item.detailAvailable ? "查看详情" : "详情暂不可用"), 9, ["onClick", "disabled"]),
                          _createElementVNode("div", { class: "rec-price" }, [
                            _createElementVNode(
                              "span",
                              null,
                              _toDisplayString(_ctx.money(item.priceCent)),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode("span", { class: "pick-mini" }, [
                              _createVNode2(_component_Icon, {
                                name: "plus",
                                size: 15
                              })
                            ])
                          ])
                        ])
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ]),
                _ctx.proposalFeedback ? (_openBlock(), _createElementBlock(
                  "div",
                  {
                    key: 0,
                    class: "proposal-feedback",
                    role: "alert"
                  },
                  _toDisplayString(_ctx.proposalFeedback),
                  1
                  /* TEXT */
                )) : _createCommentVNode("v-if", true),
                _createElementVNode("div", { class: "proposal-footer" }, [
                  _createElementVNode("div", { class: "proposal-total" }, [
                    _createElementVNode(
                      "span",
                      null,
                      "已选 " + _toDisplayString(_ctx.selectedIds.length) + " 件",
                      1
                      /* TEXT */
                    ),
                    _createElementVNode(
                      "strong",
                      null,
                      _toDisplayString(_ctx.money(_ctx.total)),
                      1
                      /* TEXT */
                    )
                  ]),
                  _createElementVNode("div", { class: "proposal-actions" }, [
                    !_ctx.preview && ((_a = _ctx.proposal) == null ? void 0 : _a.status) === "PENDING" ? (_openBlock(), _createElementBlock("button", {
                      key: 0,
                      class: "ghost-decline",
                      onClick: _ctx.reject
                    }, "放弃", 8, ["onClick"])) : _createCommentVNode("v-if", true),
                    _createElementVNode("button", {
                      class: "confirm-button",
                      onClick: _ctx.confirm,
                      disabled: _ctx.preview || _ctx.thinking || !_ctx.selectedIds.length || !_ctx.preview && ((_b = _ctx.proposal) == null ? void 0 : _b.status) !== "PENDING"
                    }, [
                      _createVNode2(_component_Icon, {
                        name: "check",
                        size: 17
                      }),
                      _createTextVNode(
                        _toDisplayString(((_c = _ctx.proposal) == null ? void 0 : _c.status) === "CONFIRMED" ? "已确认" : _ctx.confirmingProposal ? "确认中…" : "确认加购"),
                        1
                        /* TEXT */
                      )
                    ], 8, ["onClick", "disabled"])
                  ])
                ])
              ])) : _createCommentVNode("v-if", true),
              _createElementVNode("div", {
                class: "chat-composer-placeholder",
                "aria-hidden": "true"
              }),
              _createElementVNode("form", {
                class: "chat-composer",
                onSubmit: _withModifiers(($event) => _ctx.ask(), ["prevent"])
              }, [
                _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": ($event) => _ctx.input = $event,
                  disabled: _ctx.thinking || _ctx.openingConversation,
                  "aria-label": "输入问题",
                  maxlength: "500",
                  placeholder: "问问 AI，帮你找好物…"
                }, null, 8, ["onUpdate:modelValue", "disabled"]), [
                  [_vModelText, _ctx.input]
                ]),
                _ctx.thinking ? (_openBlock(), _createElementBlock("button", {
                  key: 0,
                  type: "button",
                  class: "stream-cancel",
                  onClick: _ctx.cancelTurn,
                  disabled: _ctx.cancelRequested || !_ctx.store.conversationId
                }, _toDisplayString(_ctx.cancelRequested ? "停止中…" : "停止生成"), 9, ["onClick", "disabled"])) : (_openBlock(), _createElementBlock("button", {
                  key: 1,
                  type: "submit",
                  disabled: _ctx.openingConversation || !_ctx.input.trim(),
                  "aria-label": "发送问题"
                }, [
                  _createVNode2(_component_Icon, {
                    name: "send",
                    size: 20
                  })
                ], 8, ["disabled"]))
              ], 40, ["onSubmit"])
            ];
          }),
          _: 1
          /* STABLE */
        });
      };
    })()
  };
  const LOCAL_UPLOAD = /^\/media\/[a-f0-9-]+\.png$/;
  const QINIU_UPLOAD = /^\/media\/qiniu\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/;
  function uploadedImageUrl(value) {
    if (typeof value !== "string" || value !== value.trim()) return "";
    return LOCAL_UPLOAD.test(value) || QINIU_UPLOAD.test(value) ? value : "";
  }
  const { ref: ref$d, computed: computed$d, onBeforeUnmount: onBeforeUnmount$1, watch: watch$b } = Vue;
  const VALID_TYPES$1 = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/gif"]);
  const MAX_BYTES$1 = 2e6;
  const ProductImageField = {
    name: "ProductImageField",
    components: { ProductImage },
    props: {
      modelValue: { type: String, default: "" },
      merchantId: { type: String, required: true },
      contextKey: { type: String, default: "" },
      disabled: { type: Boolean, default: false },
      demo: { type: Boolean, default: false }
    },
    emits: ["update:modelValue", "busy", "invalid"],
    setup(props, { emit: emit2 }) {
      const busy = ref$d(false), error = ref$d(""), notice = ref$d(""), localUrl = ref$d("");
      const scope = requestScope();
      let alive = true, epoch = 0;
      watch$b(
        () => [props.merchantId, props.contextKey],
        () => {
          ++epoch;
          release();
          busy.value = false;
          error.value = "";
          notice.value = "";
          emit2("busy", false);
          emit2("invalid", false);
        }
      );
      function release() {
        if (localUrl.value) {
          URL.revokeObjectURL(localUrl.value);
          localUrl.value = "";
        }
      }
      onBeforeUnmount$1(() => {
        alive = false;
        release();
        if (busy.value) emit2("busy", false);
        if (error.value) emit2("invalid", false);
      });
      watch$b(
        () => props.modelValue,
        () => {
          if (!busy.value) release();
        }
      );
      const displayed = computed$d(() => localUrl.value || props.modelValue || "");
      function clear() {
        if (props.disabled || busy.value) return;
        release();
        error.value = "";
        notice.value = "";
        emit2("invalid", false);
        emit2("update:modelValue", "");
      }
      async function choose(event) {
        var _a;
        const file = (_a = event.target.files) == null ? void 0 : _a[0];
        event.target.value = "";
        if (!file || props.disabled || busy.value) return;
        error.value = "";
        notice.value = "";
        emit2("invalid", false);
        if (!VALID_TYPES$1.has(file.type)) {
          error.value = "请选择 JPG、PNG 或 GIF 图片";
          emit2("invalid", true);
          return;
        }
        if (!file.size || file.size > MAX_BYTES$1) {
          error.value = "图片大小不能超过 2 MB";
          emit2("invalid", true);
          return;
        }
        release();
        localUrl.value = URL.createObjectURL(file);
        if (props.demo) {
          notice.value = "仅本地预览，未上传";
          return;
        }
        const mid = props.merchantId, context = props.contextKey, stamp = ++epoch, valid = scope.capture();
        const current = () => alive && valid() && stamp === epoch && mid === props.merchantId && context === props.contextKey;
        busy.value = true;
        emit2("busy", true);
        try {
          const base64 = await new Promise((resolve2, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error("图片读取失败"));
            reader.onload = () => resolve2(String(reader.result).split(",")[1] || "");
            reader.readAsDataURL(file);
          });
          if (!current()) return;
          const result = await api("/merchants/" + encodeURIComponent(mid) + "/images", {
            method: "POST",
            body: { filename: file.name, contentType: file.type, base64 }
          });
          const url = uploadedImageUrl(result == null ? void 0 : result.url);
          if (!url) throw new Error("图片上传返回地址无效");
          if (!current()) return;
          emit2("update:modelValue", url);
          notice.value = "上传成功，保存商品后生效";
          release();
        } catch (err) {
          if (current()) {
            error.value = err.message || "上传失败";
            emit2("invalid", true);
            release();
          }
        } finally {
          if (current()) {
            busy.value = false;
            emit2("busy", false);
          }
        }
      }
      return { choose, clear, displayed, busy, error, notice };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode2, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, createTextVNode: _createTextVNode, normalizeClass: _normalizeClass } = Vue;
      return function render2(_ctx, _cache) {
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_Icon = _resolveComponent("Icon");
        return _openBlock(), _createElementBlock("div", { class: "product-image-field" }, [
          _createElementVNode("div", { class: "product-image-preview" }, [
            _createVNode2(_component_ProductImage, {
              src: _ctx.displayed,
              alt: "商品主图预览",
              loading: "eager"
            }, null, 8, ["src"]),
            _ctx.busy ? (_openBlock(), _createElementBlock("span", {
              key: 0,
              class: "product-image-busy"
            }, "上传中…")) : _createCommentVNode("v-if", true)
          ]),
          _createElementVNode("div", { class: "product-image-controls" }, [
            _createElementVNode(
              "label",
              {
                class: _normalizeClass(["image-upload-button", { disabled: _ctx.disabled || _ctx.busy }])
              },
              [
                _createVNode2(_component_Icon, {
                  name: "upload",
                  size: 15
                }),
                _createTextVNode(
                  _toDisplayString(_ctx.modelValue || _ctx.displayed ? "更换主图" : "上传主图") + " ",
                  1
                  /* TEXT */
                ),
                _createElementVNode("input", {
                  type: "file",
                  accept: "image/png,image/jpeg,image/gif",
                  "aria-label": "选择商品主图",
                  disabled: _ctx.disabled || _ctx.busy,
                  onChange: _ctx.choose
                }, null, 40, ["disabled", "onChange"])
              ],
              2
              /* CLASS */
            ),
            _ctx.modelValue || _ctx.displayed || _ctx.error ? (_openBlock(), _createElementBlock("button", {
              key: 0,
              class: "image-remove-button",
              type: "button",
              disabled: _ctx.disabled || _ctx.busy,
              onClick: _ctx.clear
            }, "移除", 8, ["disabled", "onClick"])) : _createCommentVNode("v-if", true),
            _createElementVNode("small", null, "JPG / PNG / GIF · ≤ 2MB"),
            _ctx.error ? (_openBlock(), _createElementBlock(
              "span",
              {
                key: 1,
                class: "image-field-error",
                role: "alert"
              },
              _toDisplayString(_ctx.error),
              1
              /* TEXT */
            )) : _ctx.notice ? (_openBlock(), _createElementBlock(
              "span",
              {
                key: 2,
                class: "image-field-notice",
                role: "status"
              },
              _toDisplayString(_ctx.notice),
              1
              /* TEXT */
            )) : _createCommentVNode("v-if", true)
          ])
        ]);
      };
    })()
  };
  const { ref: ref$c, computed: computed$c, watch: watch$a, onBeforeUnmount } = Vue;
  const VALID_TYPES = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/gif"]);
  const MAX_BYTES = 2e6;
  const MAX_IMAGES = 8;
  const INVALID_FILE = "图片须为 JPG、PNG 或 GIF，且不超过 2 MB";
  const DUPLICATE_FILE = "同一批中重复选择（同名、同大小、同类型），已跳过";
  const DUPLICATE_URL = "图片不能重复";
  const LIMIT_MESSAGE = "商品最多保存 8 张图片";
  const ProductImageListField = {
    name: "ProductImageListField",
    components: { ProductImage },
    props: {
      modelValue: { type: Array, default: () => [] },
      merchantId: { type: String, required: true },
      contextKey: { type: String, default: "" },
      invalid: Boolean,
      disabled: Boolean,
      demo: Boolean
    },
    emits: ["update:modelValue", "busy", "invalid"],
    setup(props, { emit: emit2 }) {
      const busy = ref$c(false), error = ref$c(""), notice = ref$c(""), demoValues = ref$c(null), failures = ref$c([]), blocked = ref$c(Boolean(props.invalid));
      const values = computed$c(
        () => props.demo && demoValues.value ? demoValues.value : props.modelValue || []
      );
      const scope = requestScope(), localUrls = /* @__PURE__ */ new Set();
      let alive = true, epoch = 0, failureSequence = 0;
      function release() {
        for (const url of localUrls) URL.revokeObjectURL(url);
        localUrls.clear();
        demoValues.value = null;
      }
      function reset() {
        ++epoch;
        release();
        busy.value = false;
        error.value = "";
        notice.value = "";
        failures.value = [];
        blocked.value = false;
        emit2("busy", false);
        emit2("invalid", false);
      }
      watch$a(
        () => [
          props.merchantId,
          props.contextKey,
          props.demo,
          store.identityVersion,
          store.route,
          store.merchantId
        ],
        reset
      );
      onBeforeUnmount(() => {
        alive = false;
        ++epoch;
        release();
        if (busy.value) emit2("busy", false);
      });
      function update(next) {
        if (props.demo) demoValues.value = next;
        else emit2("update:modelValue", next);
      }
      function releaseUrl(url) {
        if (localUrls.delete(url)) URL.revokeObjectURL(url);
      }
      function syncInvalid() {
        const pending = failures.value;
        if (pending.length)
          error.value = "有 " + pending.length + " 张图片未完成：" + pending.map((item) => item.name + "（" + item.message + "）").join("；");
        else if (!blocked.value) error.value = "";
        emit2("invalid", pending.length > 0 || blocked.value);
      }
      function clearInvalid() {
        if (props.disabled || busy.value) return;
        failures.value = [];
        blocked.value = false;
        error.value = "";
        notice.value = "";
        emit2("invalid", false);
      }
      function move(i, d) {
        if (props.disabled || busy.value) return;
        const next = values.value.slice(), j = i + d;
        if (j < 0 || j >= next.length) return;
        [next[i], next[j]] = [next[j], next[i]];
        update(next);
      }
      function remove2(i) {
        if (props.disabled || busy.value) return;
        const next = values.value.slice(), removed = next.splice(i, 1)[0];
        releaseUrl(removed);
        update(next);
        syncInvalid();
      }
      function removeFailed(id) {
        if (props.disabled || busy.value) return;
        failures.value = failures.value.filter((item) => item.id !== id);
        syncInvalid();
      }
      function validate(file) {
        if (!VALID_TYPES.has(file.type) || !file.size || file.size > MAX_BYTES) return INVALID_FILE;
        return "";
      }
      function fingerprint(file) {
        return [file.name, file.size, file.type].join("\0");
      }
      function readBase64(file) {
        return new Promise((resolve2, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error("图片读取失败"));
          reader.onload = () => resolve2(String(reader.result).split(",")[1] || "");
          reader.readAsDataURL(file);
        });
      }
      function previewUrl(file) {
        const url = URL.createObjectURL(file);
        localUrls.add(url);
        return url;
      }
      async function uploadFile(file, base64, merchant) {
        const result = await api("/merchants/" + encodeURIComponent(merchant) + "/images", {
          method: "POST",
          body: { filename: file.name, contentType: file.type, base64 }
        });
        const url = uploadedImageUrl(result == null ? void 0 : result.url);
        if (!url) throw new Error("图片上传返回地址无效");
        return url;
      }
      async function process(entries) {
        if (!entries.length || !alive || props.disabled || busy.value) return;
        const merchant = props.merchantId, context = props.contextKey, demo = props.demo, stamp = ++epoch, valid = demo ? null : scope.capture();
        const current = () => alive && stamp === epoch && merchant === props.merchantId && context === props.contextKey && demo === props.demo && (demo || valid());
        const working = values.value.slice(), seen = /* @__PURE__ */ new Set(), batch2 = [];
        busy.value = true;
        emit2("busy", true);
        try {
          for (const entry of entries) {
            const file = entry.file;
            try {
              if (!current()) return;
              const invalid = validate(file);
              if (invalid) throw new Error(invalid);
              const key = fingerprint(file);
              if (seen.has(key)) throw new Error(DUPLICATE_FILE);
              seen.add(key);
              if (working.length >= MAX_IMAGES) throw new Error(LIMIT_MESSAGE);
              let url;
              if (demo) {
                url = previewUrl(file);
              } else {
                const base64 = await readBase64(file);
                if (!current()) return;
                url = await uploadFile(file, base64, merchant);
              }
              if (!current()) {
                releaseUrl(url);
                return;
              }
              if (working.includes(url)) {
                releaseUrl(url);
                throw new Error(DUPLICATE_URL);
              }
              working.push(url);
              update(working.slice());
            } catch (cause) {
              batch2.push({
                id: entry.id || ++failureSequence,
                file,
                name: file.name || "未命名图片",
                message: (cause == null ? void 0 : cause.message) || "图片上传失败"
              });
            }
          }
        } finally {
          if (current()) {
            if (batch2.length) failures.value = failures.value.concat(batch2);
            if (!failures.value.length && !blocked.value)
              notice.value = demo ? "仅本地预览，未上传" : "上传成功，保存商品后生效";
            busy.value = false;
            emit2("busy", false);
            syncInvalid();
          }
        }
      }
      async function choose(event) {
        const files = [...event.target.files || []];
        event.target.value = "";
        if (!files.length || props.disabled || busy.value) return;
        notice.value = "";
        syncInvalid();
        if (values.value.length + files.length > MAX_IMAGES) {
          blocked.value = true;
          error.value = LIMIT_MESSAGE;
          emit2("invalid", true);
          return;
        }
        await process(files.map((file) => ({ file })));
      }
      async function retry(item) {
        if (props.disabled || busy.value || !alive) return;
        failures.value = failures.value.filter((candidate) => candidate.id !== item.id);
        syncInvalid();
        await process([{ file: item.file, id: item.id }]);
      }
      return {
        values,
        busy,
        error,
        notice,
        failures,
        choose,
        move,
        remove: remove2,
        retry,
        removeFailed,
        clearInvalid
      };
    },
    render: (() => {
      const { renderList: _renderList, Fragment: _Fragment, openBlock: _openBlock, createElementBlock: _createElementBlock, resolveComponent: _resolveComponent, createVNode: _createVNode2, createCommentVNode: _createCommentVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, createTextVNode: _createTextVNode, normalizeClass: _normalizeClass } = Vue;
      return function render2(_ctx, _cache) {
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_Icon = _resolveComponent("Icon");
        return _openBlock(), _createElementBlock("div", { class: "product-image-list-field" }, [
          _createElementVNode("div", { class: "product-image-list" }, [
            (_openBlock(true), _createElementBlock(
              _Fragment,
              null,
              _renderList(_ctx.values, (url, i) => {
                return _openBlock(), _createElementBlock("div", {
                  key: url,
                  class: "product-image-tile"
                }, [
                  _createVNode2(_component_ProductImage, {
                    src: url,
                    alt: "商品图片" + (i + 1)
                  }, null, 8, ["src", "alt"]),
                  i === 0 ? (_openBlock(), _createElementBlock("span", { key: 0 }, "主图")) : _createCommentVNode("v-if", true),
                  _createElementVNode("div", null, [
                    _createElementVNode("button", {
                      type: "button",
                      "aria-label": "左移商品图片" + (i + 1),
                      disabled: _ctx.disabled || _ctx.busy || i === 0,
                      onClick: ($event) => _ctx.move(i, -1)
                    }, "←", 8, ["aria-label", "disabled", "onClick"]),
                    _createElementVNode("button", {
                      type: "button",
                      "aria-label": "右移商品图片" + (i + 1),
                      disabled: _ctx.disabled || _ctx.busy || i === _ctx.values.length - 1,
                      onClick: ($event) => _ctx.move(i, 1)
                    }, "→", 8, ["aria-label", "disabled", "onClick"]),
                    _createElementVNode("button", {
                      type: "button",
                      "aria-label": "移除商品图片" + (i + 1),
                      disabled: _ctx.disabled || _ctx.busy,
                      onClick: ($event) => _ctx.remove(i)
                    }, "删除", 8, ["aria-label", "disabled", "onClick"])
                  ])
                ]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ]),
          _ctx.failures.length ? (_openBlock(), _createElementBlock("div", {
            key: 0,
            class: "product-image-failures",
            role: "status"
          }, [
            (_openBlock(true), _createElementBlock(
              _Fragment,
              null,
              _renderList(_ctx.failures, (item) => {
                return _openBlock(), _createElementBlock("div", {
                  key: item.id,
                  class: "product-image-failure"
                }, [
                  _createElementVNode(
                    "span",
                    null,
                    _toDisplayString(item.name) + "：" + _toDisplayString(item.message),
                    1
                    /* TEXT */
                  ),
                  _createElementVNode("button", {
                    type: "button",
                    "aria-label": "重试图片" + item.name,
                    disabled: _ctx.disabled || _ctx.busy,
                    onClick: ($event) => _ctx.retry(item)
                  }, "重试", 8, ["aria-label", "disabled", "onClick"]),
                  _createElementVNode("button", {
                    type: "button",
                    "aria-label": "移除失败图片" + item.name,
                    disabled: _ctx.disabled || _ctx.busy,
                    onClick: ($event) => _ctx.removeFailed(item.id)
                  }, "移除", 8, ["aria-label", "disabled", "onClick"])
                ]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])) : _createCommentVNode("v-if", true),
          _createElementVNode(
            "label",
            {
              class: _normalizeClass(["image-upload-button", { disabled: _ctx.disabled || _ctx.busy || _ctx.values.length >= 8 }])
            },
            [
              _createVNode2(_component_Icon, {
                name: "upload",
                size: 15
              }),
              _createTextVNode(
                _toDisplayString(_ctx.busy ? "上传中…" : "添加图片"),
                1
                /* TEXT */
              ),
              _createElementVNode("input", {
                type: "file",
                multiple: "",
                accept: "image/png,image/jpeg,image/gif",
                "aria-label": "选择商品图片",
                disabled: _ctx.disabled || _ctx.busy || _ctx.values.length >= 8,
                onChange: _ctx.choose
              }, null, 40, ["disabled", "onChange"])
            ],
            2
            /* CLASS */
          ),
          _createElementVNode("small", null, "最多 8 张；第一张为主图"),
          _ctx.error || _ctx.invalid ? (_openBlock(), _createElementBlock(
            "span",
            {
              key: 1,
              class: "image-field-error",
              role: "alert"
            },
            _toDisplayString(_ctx.error || "图片处理未完成，请重新选择或放弃本次选择"),
            1
            /* TEXT */
          )) : _ctx.notice ? (_openBlock(), _createElementBlock(
            "span",
            {
              key: 2,
              class: "image-field-notice",
              role: "status"
            },
            _toDisplayString(_ctx.notice),
            1
            /* TEXT */
          )) : _createCommentVNode("v-if", true),
          _ctx.error || _ctx.invalid ? (_openBlock(), _createElementBlock("button", {
            key: 3,
            type: "button",
            disabled: _ctx.disabled || _ctx.busy,
            onClick: _ctx.clearInvalid
          }, "放弃本次图片选择", 8, ["disabled", "onClick"])) : _createCommentVNode("v-if", true)
        ]);
      };
    })()
  };
  const { ref: ref$b, computed: computed$b, watch: watch$9, nextTick: nextTick$1, onMounted: onMounted$a, onUnmounted: onUnmounted$7 } = Vue;
  const MENU = [
    ["home", "工作台", "/merchant"],
    ["package", "商品管理", "/merchant/products"],
    ["box", "库存管理", "/merchant/inventory"],
    ["order", "订单管理", "/merchant/orders"],
    ["scan", "自提核销", "/merchant/pickup"],
    ["clipboard", "售后处理", "/merchant/aftersales"],
    ["users", "店员管理", "/merchant/team"],
    ["shield", "角色权限", "/merchant/roles"],
    ["book", "知识库", "/merchant/knowledge"],
    ["settings", "门店设置", "/merchant/settings"]
  ];
  const Merchant = {
    name: "Merchant",
    components: { AuthDialog, ProductImage, ProductImageField, ProductImageListField },
    setup() {
      const scope = requestScope();
      const search = ref$b("");
      const category = ref$b("");
      const status = ref$b("");
      const sort = ref$b("NEWEST");
      const page = ref$b(1);
      const selectedId = ref$b("");
      const selectedSkuId = ref$b("");
      const drawerTab = ref$b("stock");
      const loginOpen = ref$b(false);
      const adjustment = ref$b(1);
      const pendingReplenishKey = ref$b("");
      const pendingReplenishPayload = ref$b("");
      const saving = ref$b(false);
      const modal2 = ref$b("");
      const activePriceSku = ref$b(null);
      const newPrice = ref$b("");
      const form = ref$b({
        title: "",
        description: "",
        categoryCode: "food",
        imageUrl: "",
        imageUrls: [],
        skus: [{ specKey: "默认规格", price: "4.50" }]
      });
      const skuForm = ref$b({ specKey: "", price: "" });
      const info = ref$b({
        title: "",
        description: "",
        categoryCode: "food",
        imageUrl: "",
        imageUrls: []
      });
      const createImageUploading = ref$b(false), editImageUploading = ref$b(false);
      const createImageInvalid = ref$b(false), editImageInvalid = ref$b(false);
      const merchant = computed$b(
        () => store.merchants.find((m) => m.merchantId === store.merchantId) || store.merchants[0] || {}
      );
      const owned = computed$b(() => hasPermission("product.write"));
      const required = {
        "/merchant": "order.read",
        "/merchant/products": "product.read",
        "/merchant/inventory": "stock.read",
        "/merchant/orders": "order.read",
        "/merchant/pickup": "pickup.verify",
        "/merchant/aftersales": "aftersale.read",
        "/merchant/team": "team.manage",
        "/merchant/roles": "role.manage",
        "/merchant/knowledge": "knowledge.read",
        "/merchant/settings": "store.manage"
      };
      const visibleMenu = computed$b(() => MENU.filter(([, , path]) => hasPermission(required[path])));
      const mobileNav = ref$b(null);
      const alignMobileNav = () => {
        var _a;
        const nav = mobileNav.value;
        if (nav == null ? void 0 : nav.clientWidth)
          (_a = nav.querySelector("button.active")) == null ? void 0 : _a.scrollIntoView({ inline: "center", block: "nearest" });
      };
      watch$9(
        [() => store.route, () => visibleMenu.value.map((item) => item[2]).join("|")],
        async () => {
          await nextTick$1();
          alignMobileNav();
        },
        { immediate: true, flush: "post" }
      );
      onMounted$a(() => window.addEventListener("resize", alignMobileNav));
      onUnmounted$7(() => window.removeEventListener("resize", alignMobileNav));
      const canReplenish = computed$b(() => hasPermission("stock.replenish"));
      const canRead = computed$b(() => hasPermission("product.read"));
      const items2 = computed$b(() => store.products.filter((p2) => p2.merchantId === store.merchantId));
      const selected = computed$b(
        () => items2.value.find((p2) => p2.productId === selectedId.value) || items2.value[0] || null
      );
      const selectedSku = computed$b(
        () => {
          var _a, _b;
          return ((_b = (_a = selected.value) == null ? void 0 : _a.skus) == null ? void 0 : _b.find((s) => s.skuId === selectedSkuId.value)) || skuOf(selected.value);
        }
      );
      const stock = computed$b(
        () => store.stocks.find((s) => {
          var _a;
          return s.skuId === ((_a = selectedSku.value) == null ? void 0 : _a.skuId);
        }) || null
      );
      const activeSkuCount = (p2) => ((p2 == null ? void 0 : p2.skus) || []).filter((s) => s.status === "ACTIVE").length;
      const skuStatusReason = (p2, s) => (p2 == null ? void 0 : p2.status) === "PUBLISHED" && s.status === "ACTIVE" && activeSkuCount(p2) <= 1 ? "已上架商品须保留至少一个有效规格" : "";
      const publishReason = (p2) => (p2 == null ? void 0 : p2.status) !== "PUBLISHED" && !activeSkuCount(p2) ? "请先启用至少一个规格再上架" : "";
      const count = computed$b(() => ({
        all: items2.value.length,
        published: items2.value.filter((p2) => p2.status === "PUBLISHED").length,
        unpublished: items2.value.filter((p2) => p2.status !== "PUBLISHED").length,
        low: items2.value.filter((p2) => p2.status === "PUBLISHED" && available(p2) < 20).length
      }));
      const filtered = computed$b(() => {
        if (!preview) return items2.value;
        const q = search.value.trim().toLowerCase();
        return items2.value.filter(
          (p2) => (!q || p2.title.toLowerCase().includes(q) || p2.skus.some(
            (s) => s.specKey.toLowerCase().includes(q) || s.skuId.toLowerCase().includes(q)
          )) && (!category.value || p2.categoryCode === category.value) && (!status.value || (status.value === "low" ? p2.status === "PUBLISHED" && available(p2) < 20 : p2.status === status.value))
        );
      });
      const totalPages = computed$b(
        () => Math.max(1, Math.ceil((preview ? filtered.value.length : store.merchantPage.total) / 9))
      );
      const pageRows = computed$b(
        () => preview ? filtered.value.slice((page.value - 1) * 9, page.value * 9) : filtered.value
      );
      const inventoryPercent = computed$b(
        () => {
          var _a, _b;
          return Math.min(
            100,
            Number(((_a = stock.value) == null ? void 0 : _a.available) || 0) / Math.max(1, Number(((_b = stock.value) == null ? void 0 : _b.onHand) || 0)) * 100
          );
        }
      );
      const tableCategory = (p2) => {
        var _a;
        return ((_a = store.categories.find((c) => c.code === p2.categoryCode)) == null ? void 0 : _a.name) || p2.categoryCode;
      };
      const choose = (p2) => {
        var _a;
        if (p2.productId !== ((_a = selected.value) == null ? void 0 : _a.productId)) editImageInvalid.value = false;
        selectedId.value = p2.productId;
        selectedSkuId.value = skuOf(p2).skuId || "";
        drawerTab.value = "stock";
      };
      watch$9(
        selected,
        (p2, previous) => {
          var _a;
          if ((p2 == null ? void 0 : p2.productId) !== (previous == null ? void 0 : previous.productId)) {
            editImageInvalid.value = false;
            editImageUploading.value = false;
          }
          if (p2) {
            if (!p2.skus.some((s) => s.skuId === selectedSkuId.value))
              selectedSkuId.value = skuOf(p2).skuId || "";
            info.value = {
              title: p2.title,
              description: p2.description || "",
              categoryCode: p2.categoryCode,
              imageUrl: p2.imageUrl || "",
              imageUrls: ((_a = p2.images) == null ? void 0 : _a.length) ? p2.images.map((i) => i.url) : p2.imageUrl ? [p2.imageUrl] : []
            };
          }
        },
        { immediate: true }
      );
      let searchDelay;
      function refreshPage() {
        if (preview) return;
        loadMerchant({
          signal: scope.begin().signal,
          page: page.value,
          size: 9,
          q: search.value,
          category: category.value,
          status: status.value === "low" ? "LOW_STOCK" : status.value,
          sort: sort.value
        });
      }
      onMounted$a(refreshPage);
      onUnmounted$7(() => clearTimeout(searchDelay));
      let resettingPage = false;
      watch$9(
        [page, search, category, status, sort],
        (next, previous) => {
          if (resettingPage) return;
          clearTimeout(searchDelay);
          if (!preview) {
            invalidateMerchantSearch();
            scope.begin();
            store.loading = true;
          }
          const changed = next.slice(1).some((v, i) => v !== previous[i + 1]);
          if (changed) {
            resettingPage = true;
            page.value = 1;
            resettingPage = false;
          }
          searchDelay = setTimeout(refreshPage, next[1] !== previous[1] ? 280 : 0);
        },
        { flush: "sync" }
      );
      function openCreate() {
        var _a;
        createImageUploading.value = false;
        createImageInvalid.value = false;
        form.value = {
          title: "",
          description: "",
          categoryCode: ((_a = store.categories.find((c) => c.active)) == null ? void 0 : _a.code) || "food",
          imageUrl: "",
          imageUrls: [],
          skus: [{ specKey: "默认规格", price: "" }]
        };
        modal2.value = "create";
      }
      function openPrice(sku2) {
        activePriceSku.value = sku2;
        newPrice.value = (Number(sku2.priceCent) / 100).toFixed(2);
        modal2.value = "price";
      }
      function yuanToCent(value) {
        const v = String(value).trim();
        if (!/^\d{1,7}(\.\d{1,2})?$/.test(v)) throw new Error("请输入正确金额（最多两位小数）");
        const [a, b = ""] = v.split(".");
        const cent = Number(a) * 100 + Number((b + "00").slice(0, 2));
        if (cent <= 0) throw new Error("价格必须大于零");
        if (cent > 1e8) throw new Error("价格不能超过1,000,000元");
        return cent;
      }
      async function create() {
        if (previewGuard() || saving.value || createImageUploading.value) return;
        if (createImageInvalid.value) {
          notify("请重新选择图片，或移除失败的图片");
          return;
        }
        const f = form.value;
        if (!f.title.trim() || !f.skus.length || f.skus.length > 20) {
          notify("请填写商品名称及1至20个规格");
          return;
        }
        const keys = /* @__PURE__ */ new Set();
        let skus;
        try {
          skus = f.skus.map((item) => {
            const specKey = item.specKey.trim();
            if (!specKey || specKey.length > 100 || keys.has(specKey))
              throw new Error("规格不能为空且不能重复");
            keys.add(specKey);
            return { specKey, priceCent: yuanToCent(item.price) };
          });
        } catch (e) {
          notify(e.message);
          return;
        }
        saving.value = true;
        try {
          await api("/merchants/" + encodeURIComponent(store.merchantId) + "/products", {
            method: "POST",
            body: {
              title: f.title.trim(),
              description: f.description.trim(),
              categoryCode: f.categoryCode,
              imageUrl: f.imageUrl || "",
              imageUrls: f.imageUrls,
              skus
            }
          });
          modal2.value = "";
          await loadMerchant();
          notify("商品已创建（草稿）");
        } catch (e) {
          notify(e.message);
        } finally {
          saving.value = false;
        }
      }
      function addCreateSku() {
        if (form.value.skus.length < 20) form.value.skus.push({ specKey: "", price: "" });
      }
      function removeCreateSku(index) {
        if (form.value.skus.length > 1) form.value.skus.splice(index, 1);
      }
      function openAddSku() {
        skuForm.value = { specKey: "", price: "" };
        modal2.value = "addSku";
      }
      async function addSku() {
        if (previewGuard() || saving.value || !owned.value || !selected.value) return;
        const specKey = skuForm.value.specKey.trim();
        if (!specKey || specKey.length > 100 || selected.value.skus.some((s) => s.specKey === specKey)) {
          notify("规格不能为空且不能重复");
          return;
        }
        let priceCent;
        try {
          priceCent = yuanToCent(skuForm.value.price);
        } catch (e) {
          notify(e.message);
          return;
        }
        saving.value = true;
        try {
          await api(
            "/merchants/" + encodeURIComponent(store.merchantId) + "/products/" + encodeURIComponent(selected.value.productId) + "/skus",
            { method: "POST", body: { specKey, priceCent } }
          );
          modal2.value = "";
          await loadMerchant();
          notify("规格已新增");
          drawerTab.value = "sku";
        } catch (e) {
          notify(e.message);
        } finally {
          saving.value = false;
        }
      }
      async function changeSkuStatus(sku2) {
        if (skuStatusReason(selected.value, sku2)) {
          notify(skuStatusReason(selected.value, sku2));
          return;
        }
        if (previewGuard() || saving.value || !owned.value || !selected.value) return;
        saving.value = true;
        try {
          await api(
            "/merchants/" + encodeURIComponent(store.merchantId) + "/products/" + encodeURIComponent(selected.value.productId) + "/skus/" + encodeURIComponent(sku2.skuId) + "/status",
            {
              method: "PUT",
              body: { active: sku2.status !== "ACTIVE", expectedVersion: selected.value.version }
            }
          );
          await loadMerchant();
          notify("规格状态已更新");
        } catch (e) {
          notify(e.message);
        } finally {
          saving.value = false;
        }
      }
      async function publish(p2) {
        if (publishReason(p2)) {
          notify(publishReason(p2));
          return;
        }
        if (previewGuard() || saving.value || !owned.value) return;
        saving.value = true;
        try {
          await api(
            "/merchants/" + encodeURIComponent(store.merchantId) + "/products/" + encodeURIComponent(p2.productId) + "/publish",
            { method: "POST", body: { published: p2.status !== "PUBLISHED" } }
          );
          await loadMerchant();
          notify(p2.status === "PUBLISHED" ? "已下架" : "已上架");
        } catch (err) {
          notify(err.message);
        } finally {
          saving.value = false;
        }
      }
      async function replenish() {
        var _a;
        if (previewGuard() || saving.value || !canReplenish.value || !((_a = selectedSku.value) == null ? void 0 : _a.skuId))
          return;
        const n = Number(adjustment.value);
        if (!Number.isInteger(n) || n < 1 || n > 1e6) {
          notify("补货数量必须为1~1000000");
          return;
        }
        const fingerprint = store.merchantId + ":" + selectedSku.value.skuId + ":" + n;
        if (fingerprint !== pendingReplenishPayload.value) {
          pendingReplenishKey.value = idempotency();
          pendingReplenishPayload.value = fingerprint;
        }
        saving.value = true;
        try {
          await api(
            "/merchants/" + encodeURIComponent(store.merchantId) + "/stocks/" + encodeURIComponent(selectedSku.value.skuId) + "/replenish",
            { method: "POST", body: { quantity: n }, key: pendingReplenishKey.value }
          );
          pendingReplenishKey.value = "";
          pendingReplenishPayload.value = "";
          adjustment.value = 1;
          await loadMerchant();
          notify("补货完成");
        } catch (err) {
          notify(err.message);
        } finally {
          saving.value = false;
        }
      }
      async function saveInfo() {
        if (previewGuard() || !owned.value || saving.value || editImageUploading.value || !selected.value)
          return;
        if (editImageInvalid.value) {
          notify("请重新选择图片，或移除失败的图片");
          return;
        }
        if (!info.value.title.trim()) {
          notify("商品名称不能为空");
          return;
        }
        saving.value = true;
        try {
          await api(
            "/merchants/" + encodeURIComponent(store.merchantId) + "/products/" + encodeURIComponent(selected.value.productId),
            {
              method: "PUT",
              body: {
                title: info.value.title.trim(),
                description: info.value.description.trim(),
                categoryCode: info.value.categoryCode,
                imageUrl: info.value.imageUrl || "",
                imageUrls: info.value.imageUrls,
                expectedVersion: selected.value.version
              }
            }
          );
          await loadMerchant();
          notify("商品信息已更新");
        } catch (err) {
          notify(err.message);
        } finally {
          saving.value = false;
        }
      }
      async function savePrice() {
        if (previewGuard() || !owned.value || saving.value || !activePriceSku.value || !selected.value)
          return;
        let cent;
        try {
          cent = yuanToCent(newPrice.value);
        } catch (e) {
          notify(e.message);
          return;
        }
        saving.value = true;
        try {
          await api(
            "/merchants/" + encodeURIComponent(store.merchantId) + "/products/" + encodeURIComponent(selected.value.productId) + "/skus/" + encodeURIComponent(activePriceSku.value.skuId) + "/price",
            { method: "PUT", body: { priceCent: cent, expectedVersion: selected.value.version } }
          );
          modal2.value = "";
          await loadMerchant();
          notify("售价已更新");
        } catch (err) {
          notify(err.message);
        } finally {
          saving.value = false;
        }
      }
      async function switchMerchant(e) {
        if (preview) {
          notify("设计预览：仅展示示例门店");
          return;
        }
        switchMerchantContext(e.target.value);
        selectedId.value = "";
      }
      return {
        mobileNav,
        priceSku,
        sort,
        canRead,
        canReplenish,
        skuForm,
        addCreateSku,
        removeCreateSku,
        openAddSku,
        addSku,
        loginOpen,
        store,
        go,
        money,
        skuOf,
        available,
        preview,
        previewGuard,
        notify,
        loadMerchant,
        invalidateMerchantSearch,
        owned,
        merchant,
        visibleMenu,
        search,
        category,
        status,
        page,
        selectedId,
        selectedSkuId,
        drawerTab,
        adjustment,
        saving,
        modal: modal2,
        activePriceSku,
        newPrice,
        form,
        info,
        selected,
        selectedSku,
        stock,
        count,
        filtered,
        totalPages,
        pageRows,
        inventoryPercent,
        tableCategory,
        createImageUploading,
        editImageUploading,
        createImageInvalid,
        editImageInvalid,
        choose,
        openCreate,
        openPrice,
        create,
        publish,
        skuStatusReason,
        publishReason,
        changeSkuStatus,
        replenish,
        saveInfo,
        savePrice,
        switchMerchant
      };
    },
    render: (() => {
      const { createElementVNode: _createElementVNode, createTextVNode: _createTextVNode, renderList: _renderList, Fragment: _Fragment, openBlock: _openBlock, createElementBlock: _createElementBlock, resolveComponent: _resolveComponent, createVNode: _createVNode2, toDisplayString: _toDisplayString, createCommentVNode: _createCommentVNode, normalizeClass: _normalizeClass, normalizeStyle: _normalizeStyle, vModelText: _vModelText, withDirectives: _withDirectives, vModelSelect: _vModelSelect, withModifiers: _withModifiers, createBlock: _createBlock, resolveDirective: _resolveDirective } = Vue;
      return function render2(_ctx, _cache) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
        const _component_Icon = _resolveComponent("Icon");
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_ProductImageListField = _resolveComponent("ProductImageListField");
        const _component_AuthDialog = _resolveComponent("AuthDialog");
        const _directive_modal = _resolveDirective("modal");
        return _openBlock(), _createElementBlock("div", { class: "merchant-shell" }, [
          _createElementVNode("aside", { class: "merchant-sidebar" }, [
            _createElementVNode("button", {
              class: "merchant-brand",
              onClick: ($event) => _ctx.go("/")
            }, [
              _createElementVNode("span", { class: "brand-pin" }, [
                _createElementVNode("span")
              ]),
              _createElementVNode("span", { class: "brand-word" }, [
                _createTextVNode("青柠校园"),
                _createElementVNode("span", { class: "brand-suffix" }, " / 商户端")
              ])
            ], 8, ["onClick"]),
            _createElementVNode("nav", { class: "merchant-nav" }, [
              (_openBlock(true), _createElementBlock(
                _Fragment,
                null,
                _renderList(_ctx.visibleMenu, ([icon, label, path]) => {
                  return _openBlock(), _createElementBlock("button", {
                    key: path,
                    class: _normalizeClass({ active: _ctx.store.route === path }),
                    onClick: ($event) => _ctx.go(path)
                  }, [
                    _createVNode2(_component_Icon, {
                      name: icon,
                      size: 19
                    }, null, 8, ["name"]),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(label),
                      1
                      /* TEXT */
                    ),
                    _ctx.store.route === path ? (_openBlock(), _createElementBlock("span", {
                      key: 0,
                      class: "nav-left-bar"
                    })) : _createCommentVNode("v-if", true)
                  ], 10, ["onClick"]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ]),
            _createElementVNode("div", { class: "merchant-sidebar-bottom" }, [
              _createElementVNode("button", {
                class: "sidebar-back",
                onClick: ($event) => _ctx.go("/")
              }, [
                _createVNode2(_component_Icon, {
                  name: "arrowLeft",
                  size: 16
                }),
                _createTextVNode(" 返回购物端")
              ], 8, ["onClick"])
            ])
          ]),
          _createElementVNode("div", { class: "merchant-content-shell" }, [
            _createElementVNode("header", { class: "merchant-topbar" }, [
              _createElementVNode("div", { class: "topbar-crumb" }, [
                _createTextVNode("运营中心 "),
                _createVNode2(_component_Icon, {
                  name: "chevronRight",
                  size: 14
                }),
                _createTextVNode(),
                _createElementVNode("strong", null, "商品管理")
              ]),
              _createElementVNode("div", { class: "merchant-topbar-tools" }, [
                _ctx.preview ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "admin-preview-tag"
                }, [
                  _createVNode2(_component_Icon, {
                    name: "circleHelp",
                    size: 14
                  }),
                  _createTextVNode("演示数据")
                ])) : _createCommentVNode("v-if", true),
                _createElementVNode("div", { class: "topbar-merchant-select" }, [
                  _createVNode2(_component_Icon, {
                    name: "store",
                    size: 16
                  }),
                  _createElementVNode("select", {
                    value: _ctx.store.merchantId,
                    onChange: _ctx.switchMerchant,
                    disabled: _ctx.preview
                  }, [
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.store.merchants, (m) => {
                        return _openBlock(), _createElementBlock("option", {
                          value: m.merchantId,
                          key: m.merchantId
                        }, _toDisplayString(m.name) + " · " + _toDisplayString(m.storeName), 9, ["value"]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ], 40, ["value", "onChange", "disabled"]),
                  _createVNode2(_component_Icon, {
                    name: "chevronDown",
                    size: 13
                  })
                ]),
                _createElementVNode(
                  "span",
                  { class: "admin-avatar" },
                  _toDisplayString(((_b = (_a = _ctx.store.user) == null ? void 0 : _a.displayName) == null ? void 0 : _b.slice(0, 1)) || "店"),
                  1
                  /* TEXT */
                ),
                _createElementVNode(
                  "span",
                  { class: "admin-user" },
                  _toDisplayString(((_c = _ctx.store.user) == null ? void 0 : _c.displayName) || "店铺账号"),
                  1
                  /* TEXT */
                )
              ])
            ]),
            _createElementVNode(
              "nav",
              {
                ref: "mobileNav",
                class: "merchant-mobile-nav",
                "aria-label": "工作台导航"
              },
              [
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.visibleMenu, ([icon, label, path]) => {
                    return _openBlock(), _createElementBlock("button", {
                      key: path,
                      class: _normalizeClass({ active: _ctx.store.route === path }),
                      onClick: ($event) => _ctx.go(path)
                    }, [
                      _createVNode2(_component_Icon, {
                        name: icon,
                        size: 16
                      }, null, 8, ["name"]),
                      _createTextVNode(
                        _toDisplayString(label),
                        1
                        /* TEXT */
                      )
                    ], 10, ["onClick"]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ],
              512
              /* NEED_PATCH */
            ),
            _createElementVNode("main", { class: "merchant-main" }, [
              _createElementVNode("div", { class: "merchant-page-heading" }, [
                _createElementVNode("div", null, [
                  _createElementVNode("h1", null, "商品管理")
                ]),
                _createElementVNode("div", { class: "head-actions" }, [
                  _createElementVNode("button", {
                    class: "outline-button small",
                    onClick: _ctx.loadMerchant,
                    disabled: _ctx.store.loading
                  }, [
                    _createVNode2(_component_Icon, {
                      name: "refresh",
                      size: 16
                    }),
                    _createTextVNode("刷新")
                  ], 8, ["onClick", "disabled"]),
                  _createElementVNode("button", {
                    class: "teal-button",
                    onClick: _ctx.openCreate,
                    disabled: !_ctx.owned
                  }, [
                    _createVNode2(_component_Icon, {
                      name: "plus",
                      size: 18
                    }),
                    _createTextVNode("新增商品")
                  ], 8, ["onClick", "disabled"])
                ])
              ]),
              _ctx.store.error ? (_openBlock(), _createElementBlock("div", {
                key: 0,
                class: "inline-error merchant-error"
              }, [
                _createVNode2(_component_Icon, {
                  name: "alert",
                  size: 18
                }),
                _createTextVNode(
                  _toDisplayString(_ctx.store.error),
                  1
                  /* TEXT */
                ),
                !_ctx.preview ? (_openBlock(), _createElementBlock("button", {
                  key: 0,
                  class: "merchant-login-action",
                  onClick: ($event) => _ctx.loginOpen = true
                }, "登录账号", 8, ["onClick"])) : _createCommentVNode("v-if", true)
              ])) : _createCommentVNode("v-if", true),
              !_ctx.canRead ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "ops-card access-denied"
              }, "当前角色没有商品查看权限，请联系商户经营者授权。")) : (_openBlock(), _createElementBlock(
                _Fragment,
                { key: 2 },
                [
                  _createElementVNode("section", {
                    class: "inventory-summary",
                    "aria-label": "商品概况"
                  }, [
                    _createElementVNode("div", { class: "summary-piece" }, [
                      _createElementVNode("span", { class: "summary-icon blue" }, [
                        _createVNode2(_component_Icon, {
                          name: "package",
                          size: 20
                        })
                      ]),
                      _createElementVNode("div", null, [
                        _createElementVNode(
                          "span",
                          null,
                          _toDisplayString(_ctx.preview ? "全部商品" : "筛选商品"),
                          1
                          /* TEXT */
                        ),
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(_ctx.preview ? _ctx.count.all : _ctx.store.merchantPage.total),
                          1
                          /* TEXT */
                        )
                      ])
                    ]),
                    _createElementVNode("div", { class: "summary-piece" }, [
                      _createElementVNode("span", { class: "summary-icon green" }, [
                        _createVNode2(_component_Icon, {
                          name: "check",
                          size: 20
                        })
                      ]),
                      _createElementVNode("div", null, [
                        _createElementVNode("span", null, "本页在售"),
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(_ctx.count.published),
                          1
                          /* TEXT */
                        )
                      ])
                    ]),
                    _createElementVNode("div", { class: "summary-piece" }, [
                      _createElementVNode("span", { class: "summary-icon orange" }, [
                        _createVNode2(_component_Icon, {
                          name: "box",
                          size: 20
                        })
                      ]),
                      _createElementVNode("div", null, [
                        _createElementVNode("span", null, "本页未上架"),
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(_ctx.count.unpublished),
                          1
                          /* TEXT */
                        )
                      ])
                    ]),
                    _createElementVNode("div", { class: "summary-piece" }, [
                      _createElementVNode("span", { class: "summary-icon red" }, [
                        _createVNode2(_component_Icon, {
                          name: "alert",
                          size: 20
                        })
                      ]),
                      _createElementVNode("div", null, [
                        _createElementVNode("span", null, "本页低库存"),
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(_ctx.count.low),
                          1
                          /* TEXT */
                        )
                      ])
                    ]),
                    _createElementVNode("div", { class: "summary-stockbar" }, [
                      _createElementVNode("span", null, "本页上架率"),
                      _createElementVNode("div", { class: "summary-stockbar-track" }, [
                        _createElementVNode(
                          "span",
                          {
                            style: _normalizeStyle({ width: (_ctx.count.all ? _ctx.count.published / _ctx.count.all * 100 : 0) + "%" })
                          },
                          null,
                          4
                          /* STYLE */
                        )
                      ]),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.count.all ? Math.round(_ctx.count.published / _ctx.count.all * 100) : 0) + "%",
                        1
                        /* TEXT */
                      )
                    ])
                  ]),
                  _createElementVNode("section", { class: "product-workspace" }, [
                    _createElementVNode("div", { class: "product-list-panel" }, [
                      _createElementVNode("div", { class: "product-tabs" }, [
                        _createElementVNode("button", {
                          class: _normalizeClass({ active: _ctx.status === "" }),
                          onClick: ($event) => _ctx.status = ""
                        }, [
                          _createTextVNode("全部 "),
                          _ctx.preview || _ctx.status === "" ? (_openBlock(), _createElementBlock(
                            "b",
                            { key: 0 },
                            _toDisplayString(_ctx.preview ? _ctx.count.all : _ctx.store.merchantPage.total),
                            1
                            /* TEXT */
                          )) : _createCommentVNode("v-if", true)
                        ], 10, ["onClick"]),
                        _createElementVNode("button", {
                          class: _normalizeClass({ active: _ctx.status === "PUBLISHED" }),
                          onClick: ($event) => _ctx.status = "PUBLISHED"
                        }, [
                          _createTextVNode("在售 "),
                          _ctx.preview || _ctx.status === "PUBLISHED" ? (_openBlock(), _createElementBlock(
                            "b",
                            { key: 0 },
                            _toDisplayString(_ctx.preview ? _ctx.count.published : _ctx.store.merchantPage.total),
                            1
                            /* TEXT */
                          )) : _createCommentVNode("v-if", true)
                        ], 10, ["onClick"]),
                        _createElementVNode("button", {
                          class: _normalizeClass({ active: _ctx.status === "UNPUBLISHED" }),
                          onClick: ($event) => _ctx.status = "UNPUBLISHED"
                        }, "已下架", 10, ["onClick"]),
                        _createElementVNode("button", {
                          class: _normalizeClass({ active: _ctx.status === "low" }),
                          onClick: ($event) => _ctx.status = "low"
                        }, [
                          _createTextVNode("本页低库存 "),
                          _createElementVNode(
                            "b",
                            null,
                            _toDisplayString(_ctx.count.low),
                            1
                            /* TEXT */
                          )
                        ], 10, ["onClick"])
                      ]),
                      _createElementVNode("div", { class: "product-toolbar" }, [
                        _createElementVNode("label", { class: "table-search" }, [
                          _createVNode2(_component_Icon, {
                            name: "search",
                            size: 17
                          }),
                          _withDirectives(_createElementVNode("input", {
                            "onUpdate:modelValue": ($event) => _ctx.search = $event,
                            placeholder: "商品名称 / SKU / 规格",
                            "aria-label": "搜索商品"
                          }, null, 8, ["onUpdate:modelValue"]), [
                            [_vModelText, _ctx.search]
                          ])
                        ]),
                        _createElementVNode("label", { class: "table-select" }, [
                          _withDirectives(_createElementVNode("select", {
                            "onUpdate:modelValue": ($event) => _ctx.category = $event,
                            "aria-label": "分类筛选"
                          }, [
                            _createElementVNode("option", { value: "" }, "全部分类"),
                            (_openBlock(true), _createElementBlock(
                              _Fragment,
                              null,
                              _renderList(_ctx.store.categories, (c) => {
                                return _openBlock(), _createElementBlock("option", {
                                  value: c.code
                                }, _toDisplayString(c.name), 9, ["value"]);
                              }),
                              256
                              /* UNKEYED_FRAGMENT */
                            ))
                          ], 8, ["onUpdate:modelValue"]), [
                            [_vModelSelect, _ctx.category]
                          ]),
                          _createVNode2(_component_Icon, {
                            name: "chevronDown",
                            size: 14
                          })
                        ]),
                        _createElementVNode("label", { class: "table-select" }, [
                          _withDirectives(_createElementVNode("select", {
                            "onUpdate:modelValue": ($event) => _ctx.sort = $event,
                            "aria-label": "全局排序"
                          }, [
                            _createElementVNode("option", { value: "NEWEST" }, "最新上架"),
                            _createElementVNode("option", { value: "PRICE_ASC" }, "全局价格升序"),
                            _createElementVNode("option", { value: "STOCK_DESC" }, "全局可售库存")
                          ], 8, ["onUpdate:modelValue"]), [
                            [_vModelSelect, _ctx.sort]
                          ])
                        ]),
                        _createElementVNode("button", {
                          class: "filter-reset",
                          onClick: ($event) => {
                            _ctx.search = "";
                            _ctx.category = "";
                            _ctx.status = "";
                            _ctx.sort = "NEWEST";
                          }
                        }, "重置", 8, ["onClick"]),
                        _createElementVNode(
                          "span",
                          { class: "toolbar-count" },
                          _toDisplayString(_ctx.preview ? _ctx.filtered.length : _ctx.store.merchantPage.total) + " 件",
                          1
                          /* TEXT */
                        )
                      ]),
                      _createElementVNode("div", { class: "product-table-scroll" }, [
                        _createElementVNode("table", { class: "product-table" }, [
                          _createElementVNode("thead", null, [
                            _createElementVNode("tr", null, [
                              _createElementVNode("th", null, "商品"),
                              _createElementVNode("th", null, "SKU / 规格"),
                              _createElementVNode("th", null, "分类"),
                              _createElementVNode("th", { class: "t-right" }, "售价"),
                              _createElementVNode("th", { class: "t-right" }, "可售"),
                              _createElementVNode("th", null, "状态"),
                              _createElementVNode("th", { class: "t-right" }, "操作")
                            ])
                          ]),
                          _createElementVNode("tbody", null, [
                            (_openBlock(true), _createElementBlock(
                              _Fragment,
                              null,
                              _renderList(_ctx.pageRows, (p2) => {
                                var _a2, _b2, _c2, _d2;
                                return _openBlock(), _createElementBlock("tr", {
                                  key: p2.productId,
                                  class: _normalizeClass({ "row-selected": ((_a2 = _ctx.selected) == null ? void 0 : _a2.productId) === p2.productId }),
                                  onClick: ($event) => _ctx.choose(p2)
                                }, [
                                  _createElementVNode("td", null, [
                                    _createElementVNode("div", { class: "table-product-cell" }, [
                                      _createVNode2(_component_ProductImage, {
                                        src: p2.imageUrl,
                                        alt: p2.title
                                      }, null, 8, ["src", "alt"]),
                                      _createElementVNode("div", null, [
                                        _createElementVNode("button", {
                                          class: "row-link",
                                          onClick: _withModifiers(($event) => _ctx.choose(p2), ["stop"]),
                                          "aria-pressed": ((_b2 = _ctx.selected) == null ? void 0 : _b2.productId) === p2.productId
                                        }, _toDisplayString(p2.title), 9, ["onClick", "aria-pressed"]),
                                        _createElementVNode(
                                          "span",
                                          null,
                                          _toDisplayString(p2.description || "—"),
                                          1
                                          /* TEXT */
                                        )
                                      ])
                                    ])
                                  ]),
                                  _createElementVNode("td", null, [
                                    _createElementVNode("div", { class: "sku-column" }, [
                                      _createElementVNode(
                                        "span",
                                        null,
                                        _toDisplayString(_ctx.skuOf(p2).specKey || "—"),
                                        1
                                        /* TEXT */
                                      ),
                                      _createElementVNode(
                                        "small",
                                        null,
                                        _toDisplayString(((_c2 = _ctx.skuOf(p2).skuId) == null ? void 0 : _c2.startsWith("preview")) ? "SKU-" + p2.productId.slice(-2) : ((_d2 = _ctx.skuOf(p2).skuId) == null ? void 0 : _d2.slice(-8)) || "—"),
                                        1
                                        /* TEXT */
                                      )
                                    ])
                                  ]),
                                  _createElementVNode("td", null, [
                                    _createElementVNode(
                                      "span",
                                      { class: "category-label" },
                                      _toDisplayString(_ctx.tableCategory(p2)),
                                      1
                                      /* TEXT */
                                    )
                                  ]),
                                  _createElementVNode(
                                    "td",
                                    { class: "t-right table-price" },
                                    _toDisplayString(_ctx.priceSku(p2) ? _ctx.money(_ctx.priceSku(p2).priceCent) + " 起" : "暂无有效规格"),
                                    1
                                    /* TEXT */
                                  ),
                                  _createElementVNode(
                                    "td",
                                    {
                                      class: _normalizeClass(["t-right", { "red-text": _ctx.available(p2) < 20 }])
                                    },
                                    _toDisplayString(_ctx.available(p2)),
                                    3
                                    /* TEXT, CLASS */
                                  ),
                                  _createElementVNode("td", null, [
                                    _createElementVNode(
                                      "span",
                                      {
                                        class: _normalizeClass(["status-tag", p2.status === "PUBLISHED" ? "published" : p2.status === "DRAFT" ? "draft" : "unpublished"])
                                      },
                                      [
                                        _createElementVNode("i"),
                                        _createTextVNode(
                                          _toDisplayString(p2.status === "PUBLISHED" ? "在售" : p2.status === "DRAFT" ? "草稿" : "已下架"),
                                          1
                                          /* TEXT */
                                        )
                                      ],
                                      2
                                      /* CLASS */
                                    )
                                  ]),
                                  _createElementVNode("td", { class: "t-right" }, [
                                    _createElementVNode("button", {
                                      class: "row-link",
                                      onClick: _withModifiers(($event) => _ctx.choose(p2), ["stop"])
                                    }, [
                                      _createTextVNode("查看 "),
                                      _createVNode2(_component_Icon, {
                                        name: "chevronRight",
                                        size: 14
                                      })
                                    ], 8, ["onClick"])
                                  ])
                                ], 10, ["onClick"]);
                              }),
                              128
                              /* KEYED_FRAGMENT */
                            ))
                          ])
                        ]),
                        !_ctx.pageRows.length ? (_openBlock(), _createElementBlock("div", {
                          key: 0,
                          class: "admin-empty"
                        }, [
                          _createVNode2(_component_Icon, {
                            name: "search",
                            size: 23
                          }),
                          _createElementVNode("span", null, "没有符合条件的商品")
                        ])) : _createCommentVNode("v-if", true)
                      ]),
                      _createElementVNode("div", { class: "table-footer" }, [
                        _createElementVNode(
                          "span",
                          null,
                          "共 " + _toDisplayString(_ctx.preview ? _ctx.filtered.length : _ctx.store.merchantPage.total) + " 条",
                          1
                          /* TEXT */
                        ),
                        _createElementVNode("div", null, [
                          _createElementVNode("button", {
                            disabled: _ctx.page <= 1,
                            onClick: ($event) => _ctx.page--,
                            "aria-label": "上一页"
                          }, [
                            _createVNode2(_component_Icon, {
                              name: "arrowLeft",
                              size: 16
                            })
                          ], 8, ["disabled", "onClick"]),
                          (_openBlock(true), _createElementBlock(
                            _Fragment,
                            null,
                            _renderList(_ctx.totalPages, (n) => {
                              return _openBlock(), _createElementBlock("button", {
                                key: n,
                                class: _normalizeClass({ active: _ctx.page === n }),
                                onClick: ($event) => _ctx.page = n
                              }, _toDisplayString(n), 11, ["onClick"]);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          )),
                          _createElementVNode("button", {
                            disabled: _ctx.page >= _ctx.totalPages,
                            onClick: ($event) => _ctx.page++,
                            "aria-label": "下一页"
                          }, [
                            _createVNode2(_component_Icon, {
                              name: "chevronRight",
                              size: 16
                            })
                          ], 8, ["disabled", "onClick"])
                        ])
                      ])
                    ]),
                    _ctx.selected ? (_openBlock(), _createElementBlock("aside", {
                      key: 0,
                      class: "product-inspector"
                    }, [
                      _createElementVNode("div", { class: "inspector-head" }, [
                        _createElementVNode("span", { class: "inspector-title" }, "商品详情"),
                        _createElementVNode(
                          "span",
                          { class: "inspector-id" },
                          _toDisplayString((_d = _ctx.selected.productId) == null ? void 0 : _d.slice(-9)),
                          1
                          /* TEXT */
                        )
                      ]),
                      _createElementVNode("div", { class: "inspector-product" }, [
                        _createVNode2(_component_ProductImage, {
                          src: _ctx.selected.imageUrl,
                          alt: _ctx.selected.title
                        }, null, 8, ["src", "alt"]),
                        _createElementVNode("div", null, [
                          _createElementVNode(
                            "strong",
                            null,
                            _toDisplayString(_ctx.selected.title),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "span",
                            null,
                            _toDisplayString(_ctx.tableCategory(_ctx.selected)) + " · " + _toDisplayString(_ctx.selected.skus.length) + " 个规格",
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "span",
                            {
                              class: _normalizeClass(["status-tag compact", _ctx.selected.status === "PUBLISHED" ? "published" : "unpublished"])
                            },
                            [
                              _createElementVNode("i"),
                              _createTextVNode(
                                _toDisplayString(_ctx.selected.status === "PUBLISHED" ? "在售" : "未上架"),
                                1
                                /* TEXT */
                              )
                            ],
                            2
                            /* CLASS */
                          )
                        ])
                      ]),
                      _createElementVNode("div", { class: "inspector-tabs" }, [
                        _createElementVNode("button", {
                          class: _normalizeClass({ active: _ctx.drawerTab === "stock" }),
                          onClick: ($event) => _ctx.drawerTab = "stock"
                        }, "库存", 10, ["onClick"]),
                        _createElementVNode("button", {
                          class: _normalizeClass({ active: _ctx.drawerTab === "info" }),
                          onClick: ($event) => _ctx.drawerTab = "info"
                        }, "基本信息", 10, ["onClick"]),
                        _createElementVNode("button", {
                          class: _normalizeClass({ active: _ctx.drawerTab === "sku" }),
                          onClick: ($event) => _ctx.drawerTab = "sku"
                        }, "规格售价", 10, ["onClick"])
                      ]),
                      _ctx.drawerTab === "stock" ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "inspector-body"
                      }, [
                        _createElementVNode("label", {
                          class: "field-label",
                          for: "merchant-field-1"
                        }, "选择规格"),
                        _withDirectives(_createElementVNode("select", {
                          id: "merchant-field-1",
                          "onUpdate:modelValue": ($event) => _ctx.selectedSkuId = $event,
                          class: "inspector-select"
                        }, [
                          (_openBlock(true), _createElementBlock(
                            _Fragment,
                            null,
                            _renderList(_ctx.selected.skus, (s) => {
                              return _openBlock(), _createElementBlock("option", {
                                key: s.skuId,
                                value: s.skuId
                              }, _toDisplayString(s.specKey), 9, ["value"]);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ], 8, ["onUpdate:modelValue"]), [
                          [_vModelSelect, _ctx.selectedSkuId]
                        ]),
                        _createElementVNode("div", { class: "stock-metrics" }, [
                          _createElementVNode("div", null, [
                            _createElementVNode("small", null, "实物库存"),
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(((_e = _ctx.stock) == null ? void 0 : _e.onHand) ?? "—"),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode("div", null, [
                            _createElementVNode("small", null, "已预占"),
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(((_f = _ctx.stock) == null ? void 0 : _f.reserved) ?? "—"),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode("div", null, [
                            _createElementVNode("small", null, "可售库存"),
                            _createElementVNode(
                              "strong",
                              { class: "mint-text" },
                              _toDisplayString(((_g = _ctx.stock) == null ? void 0 : _g.available) ?? ((_h = _ctx.selectedSku) == null ? void 0 : _h.available) ?? "—"),
                              1
                              /* TEXT */
                            )
                          ])
                        ]),
                        _createElementVNode("div", { class: "stock-progress" }, [
                          _createElementVNode("div", { class: "stock-progress-top" }, [
                            _createElementVNode("span", null, "可售占比"),
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(Math.round(_ctx.inventoryPercent)) + "%",
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode("div", { class: "track" }, [
                            _createElementVNode(
                              "span",
                              {
                                style: _normalizeStyle({ width: _ctx.inventoryPercent + "%" })
                              },
                              null,
                              4
                              /* STYLE */
                            )
                          ])
                        ]),
                        _ctx.stock && _ctx.stock.available < 20 ? (_openBlock(), _createElementBlock("div", {
                          key: 0,
                          class: "stock-warning"
                        }, [
                          _createVNode2(_component_Icon, {
                            name: "alert",
                            size: 17
                          }),
                          _createTextVNode("库存偏低，建议及时补货")
                        ])) : _createCommentVNode("v-if", true),
                        _createElementVNode("div", { class: "inspector-divider" }),
                        _createElementVNode("h3", { class: "field-heading" }, "库存补货"),
                        _createElementVNode("label", {
                          class: "field-label",
                          for: "restock-n"
                        }, "增加数量"),
                        _createElementVNode("div", { class: "number-input" }, [
                          _createElementVNode("button", {
                            onClick: ($event) => _ctx.adjustment = Math.max(1, Number(_ctx.adjustment) - 1),
                            "aria-label": "减少补货数量"
                          }, [
                            _createVNode2(_component_Icon, {
                              name: "minus",
                              size: 17
                            })
                          ], 8, ["onClick"]),
                          _withDirectives(_createElementVNode("input", {
                            id: "restock-n",
                            "onUpdate:modelValue": ($event) => _ctx.adjustment = $event,
                            type: "number",
                            min: "1",
                            max: "1000000"
                          }, null, 8, ["onUpdate:modelValue"]), [
                            [
                              _vModelText,
                              _ctx.adjustment,
                              void 0,
                              { number: true }
                            ]
                          ]),
                          _createElementVNode("button", {
                            onClick: ($event) => _ctx.adjustment = Math.min(1e6, Number(_ctx.adjustment) + 1),
                            "aria-label": "增加补货数量"
                          }, [
                            _createVNode2(_component_Icon, {
                              name: "plus",
                              size: 17
                            })
                          ], 8, ["onClick"])
                        ]),
                        _createElementVNode("button", {
                          class: "teal-button inspector-submit",
                          onClick: _ctx.replenish,
                          disabled: _ctx.preview || _ctx.saving || !_ctx.canReplenish || !((_i = _ctx.selectedSku) == null ? void 0 : _i.skuId)
                        }, "确认补货", 8, ["onClick", "disabled"])
                      ])) : _ctx.drawerTab === "info" ? (_openBlock(), _createElementBlock("div", {
                        key: 1,
                        class: "inspector-body"
                      }, [
                        _createElementVNode("label", {
                          class: "field-label",
                          for: "merchant-field-2"
                        }, "商品名称"),
                        _withDirectives(_createElementVNode("input", {
                          id: "merchant-field-2",
                          class: "admin-input",
                          "onUpdate:modelValue": ($event) => _ctx.info.title = $event,
                          disabled: !_ctx.owned
                        }, null, 8, ["onUpdate:modelValue", "disabled"]), [
                          [_vModelText, _ctx.info.title]
                        ]),
                        _createElementVNode("label", {
                          class: "field-label",
                          for: "merchant-field-3"
                        }, "商品分类"),
                        _withDirectives(_createElementVNode("select", {
                          id: "merchant-field-3",
                          class: "admin-input",
                          "onUpdate:modelValue": ($event) => _ctx.info.categoryCode = $event,
                          disabled: !_ctx.owned
                        }, [
                          (_openBlock(true), _createElementBlock(
                            _Fragment,
                            null,
                            _renderList(_ctx.store.categories, (c) => {
                              return _openBlock(), _createElementBlock("option", {
                                key: c.code,
                                value: c.code
                              }, _toDisplayString(c.name), 9, ["value"]);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ], 8, ["onUpdate:modelValue", "disabled"]), [
                          [_vModelSelect, _ctx.info.categoryCode]
                        ]),
                        _createElementVNode("label", {
                          class: "field-label",
                          for: "merchant-field-4"
                        }, "商品描述"),
                        _withDirectives(_createElementVNode("textarea", {
                          id: "merchant-field-4",
                          class: "admin-input",
                          rows: "4",
                          "onUpdate:modelValue": ($event) => _ctx.info.description = $event,
                          disabled: !_ctx.owned
                        }, null, 8, ["onUpdate:modelValue", "disabled"]), [
                          [_vModelText, _ctx.info.description]
                        ]),
                        _createElementVNode("label", { class: "field-label" }, "商品主图"),
                        _createVNode2(_component_ProductImageListField, {
                          modelValue: _ctx.info.imageUrls,
                          "onUpdate:modelValue": ($event) => _ctx.info.imageUrls = $event,
                          "merchant-id": _ctx.store.merchantId,
                          "context-key": _ctx.selected.productId,
                          invalid: _ctx.editImageInvalid,
                          demo: _ctx.preview,
                          disabled: !_ctx.owned || _ctx.saving,
                          onBusy: ($event) => _ctx.editImageUploading = $event,
                          onInvalid: ($event) => _ctx.editImageInvalid = $event
                        }, null, 8, ["modelValue", "onUpdate:modelValue", "merchant-id", "context-key", "invalid", "demo", "disabled", "onBusy", "onInvalid"]),
                        _createElementVNode("button", {
                          class: "teal-button inspector-submit",
                          onClick: _ctx.saveInfo,
                          disabled: _ctx.preview || _ctx.saving || _ctx.editImageUploading || _ctx.editImageInvalid || !_ctx.owned
                        }, "保存修改", 8, ["onClick", "disabled"]),
                        _createElementVNode("button", {
                          class: "inspector-link",
                          onClick: ($event) => _ctx.publish(_ctx.selected),
                          disabled: _ctx.preview || _ctx.saving || !_ctx.owned || !!_ctx.publishReason(_ctx.selected),
                          title: _ctx.publishReason(_ctx.selected)
                        }, [
                          _createTextVNode(
                            _toDisplayString(_ctx.selected.status === "PUBLISHED" ? "下架商品" : "上架商品") + " ",
                            1
                            /* TEXT */
                          ),
                          _createVNode2(_component_Icon, {
                            name: "chevronRight",
                            size: 16
                          })
                        ], 8, ["onClick", "disabled", "title"]),
                        _ctx.publishReason(_ctx.selected) ? (_openBlock(), _createElementBlock(
                          "p",
                          {
                            key: 0,
                            class: "mobile-hint"
                          },
                          _toDisplayString(_ctx.publishReason(_ctx.selected)),
                          1
                          /* TEXT */
                        )) : _createCommentVNode("v-if", true)
                      ])) : (_openBlock(), _createElementBlock("div", {
                        key: 2,
                        class: "inspector-body"
                      }, [
                        (_openBlock(true), _createElementBlock(
                          _Fragment,
                          null,
                          _renderList(_ctx.selected.skus, (sku2) => {
                            return _openBlock(), _createElementBlock("div", {
                              class: "sku-item",
                              key: sku2.skuId
                            }, [
                              _createElementVNode("div", null, [
                                _createElementVNode(
                                  "strong",
                                  null,
                                  _toDisplayString(sku2.specKey),
                                  1
                                  /* TEXT */
                                ),
                                _createElementVNode(
                                  "small",
                                  null,
                                  _toDisplayString(sku2.skuId) + " · " + _toDisplayString(sku2.status === "ACTIVE" ? "在售" : "已停用"),
                                  1
                                  /* TEXT */
                                )
                              ]),
                              _createElementVNode(
                                "strong",
                                null,
                                _toDisplayString(_ctx.money(sku2.priceCent)),
                                1
                                /* TEXT */
                              ),
                              _createElementVNode("button", {
                                disabled: !_ctx.owned || _ctx.preview || _ctx.saving || !!_ctx.skuStatusReason(_ctx.selected, sku2),
                                title: _ctx.skuStatusReason(_ctx.selected, sku2),
                                onClick: ($event) => _ctx.changeSkuStatus(sku2),
                                "aria-label": (sku2.status === "ACTIVE" ? "停用" : "启用") + sku2.specKey
                              }, _toDisplayString(sku2.status === "ACTIVE" ? "停用" : "启用"), 9, ["disabled", "title", "onClick", "aria-label"]),
                              _createElementVNode("button", {
                                disabled: !_ctx.owned || _ctx.preview || _ctx.saving,
                                onClick: ($event) => _ctx.openPrice(sku2),
                                title: "修改售价"
                              }, [
                                _createVNode2(_component_Icon, {
                                  name: "edit",
                                  size: 17
                                })
                              ], 8, ["disabled", "onClick"])
                            ]);
                          }),
                          128
                          /* KEYED_FRAGMENT */
                        )),
                        _ctx.selected.status === "PUBLISHED" ? (_openBlock(), _createElementBlock("p", {
                          key: 0,
                          class: "mobile-hint"
                        }, "已上架商品须保留至少一个有效规格。")) : _createCommentVNode("v-if", true),
                        _createElementVNode("button", {
                          class: "outline-button small",
                          disabled: !_ctx.owned || _ctx.preview || _ctx.selected.skus.length >= 20,
                          onClick: _ctx.openAddSku
                        }, [
                          _createVNode2(_component_Icon, {
                            name: "plus",
                            size: 16
                          }),
                          _createTextVNode("新增规格")
                        ], 8, ["disabled", "onClick"])
                      ]))
                    ])) : (_openBlock(), _createElementBlock("div", {
                      key: 1,
                      class: "product-inspector empty-inspector"
                    }, [
                      _createVNode2(_component_Icon, {
                        name: "package",
                        size: 28
                      }),
                      _createTextVNode("选择商品以查看详情")
                    ]))
                  ])
                ],
                64
                /* STABLE_FRAGMENT */
              ))
            ])
          ]),
          _ctx.loginOpen ? (_openBlock(), _createBlock(_component_AuthDialog, {
            key: 0,
            onClose: ($event) => _ctx.loginOpen = false,
            onSuccess: _ctx.loadMerchant
          }, null, 8, ["onClose", "onSuccess"])) : _createCommentVNode("v-if", true),
          _ctx.modal ? _withDirectives((_openBlock(), _createElementBlock("div", {
            key: 1,
            class: "ui-overlay",
            onClick: _withModifiers(($event) => _ctx.modal = "", ["self"])
          }, [
            _ctx.modal === "create" ? (_openBlock(), _createElementBlock("form", {
              key: 0,
              class: "merchant-modal",
              onSubmit: _withModifiers(_ctx.create, ["prevent"])
            }, [
              _createElementVNode("div", { class: "merchant-modal-header" }, [
                _createElementVNode("div", null, [
                  _createElementVNode("h2", null, "新增商品")
                ]),
                _createElementVNode("button", {
                  type: "button",
                  onClick: ($event) => _ctx.modal = "",
                  "aria-label": "关闭"
                }, [
                  _createVNode2(_component_Icon, {
                    name: "x",
                    size: 20
                  })
                ], 8, ["onClick"])
              ]),
              _createElementVNode("label", {
                class: "field-label",
                for: "merchant-field-5"
              }, "商品名称"),
              _withDirectives(_createElementVNode("input", {
                id: "merchant-field-5",
                class: "admin-input",
                maxlength: "100",
                "onUpdate:modelValue": ($event) => _ctx.form.title = $event,
                placeholder: "商品名称",
                required: ""
              }, null, 8, ["onUpdate:modelValue"]), [
                [_vModelText, _ctx.form.title]
              ]),
              _createElementVNode("label", {
                class: "field-label",
                for: "merchant-field-6"
              }, "分类"),
              _withDirectives(_createElementVNode("select", {
                id: "merchant-field-6",
                "onUpdate:modelValue": ($event) => _ctx.form.categoryCode = $event,
                class: "admin-input"
              }, [
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.store.categories.filter((c) => c.active), (c) => {
                    return _openBlock(), _createElementBlock("option", {
                      value: c.code
                    }, _toDisplayString(c.name), 9, ["value"]);
                  }),
                  256
                  /* UNKEYED_FRAGMENT */
                ))
              ], 8, ["onUpdate:modelValue"]), [
                [_vModelSelect, _ctx.form.categoryCode]
              ]),
              _createElementVNode("label", { class: "field-label" }, "规格 / 售价（元）"),
              (_openBlock(true), _createElementBlock(
                _Fragment,
                null,
                _renderList(_ctx.form.skus, (item, index) => {
                  return _openBlock(), _createElementBlock("div", {
                    key: index,
                    class: "sku-create-row"
                  }, [
                    _withDirectives(_createElementVNode("input", {
                      class: "admin-input",
                      maxlength: "100",
                      "onUpdate:modelValue": ($event) => item.specKey = $event,
                      required: "",
                      placeholder: "例如 250ml"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, item.specKey]
                    ]),
                    _withDirectives(_createElementVNode("input", {
                      class: "admin-input",
                      "onUpdate:modelValue": ($event) => item.price = $event,
                      inputmode: "decimal",
                      placeholder: "0.00",
                      required: ""
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, item.price]
                    ]),
                    _createElementVNode("button", {
                      type: "button",
                      class: "outline-button small",
                      disabled: _ctx.form.skus.length === 1,
                      onClick: ($event) => _ctx.removeCreateSku(index),
                      "aria-label": "移除规格" + (index + 1)
                    }, [
                      _createVNode2(_component_Icon, {
                        name: "x",
                        size: 15
                      })
                    ], 8, ["disabled", "onClick", "aria-label"])
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              )),
              _createElementVNode("button", {
                type: "button",
                class: "outline-button small",
                disabled: _ctx.form.skus.length >= 20,
                onClick: _ctx.addCreateSku
              }, [
                _createVNode2(_component_Icon, {
                  name: "plus",
                  size: 15
                }),
                _createTextVNode("添加规格")
              ], 8, ["disabled", "onClick"]),
              _createElementVNode("label", {
                class: "field-label",
                for: "merchant-field-7"
              }, "描述"),
              _withDirectives(_createElementVNode("textarea", {
                id: "merchant-field-7",
                class: "admin-input",
                rows: "3",
                "onUpdate:modelValue": ($event) => _ctx.form.description = $event,
                placeholder: "选填"
              }, null, 8, ["onUpdate:modelValue"]), [
                [_vModelText, _ctx.form.description]
              ]),
              _createElementVNode("label", { class: "field-label" }, "商品主图"),
              _createVNode2(_component_ProductImageListField, {
                modelValue: _ctx.form.imageUrls,
                "onUpdate:modelValue": ($event) => _ctx.form.imageUrls = $event,
                "merchant-id": _ctx.store.merchantId,
                invalid: _ctx.createImageInvalid,
                demo: _ctx.preview,
                disabled: _ctx.saving || !_ctx.owned,
                onBusy: ($event) => _ctx.createImageUploading = $event,
                onInvalid: ($event) => _ctx.createImageInvalid = $event
              }, null, 8, ["modelValue", "onUpdate:modelValue", "merchant-id", "invalid", "demo", "disabled", "onBusy", "onInvalid"]),
              _createElementVNode("div", { class: "form-buttons" }, [
                _createElementVNode("button", {
                  type: "button",
                  class: "outline-button",
                  onClick: ($event) => _ctx.modal = ""
                }, "取消", 8, ["onClick"]),
                _createElementVNode("button", {
                  type: "submit",
                  class: "teal-button",
                  disabled: _ctx.preview || _ctx.saving || _ctx.createImageUploading || _ctx.createImageInvalid || !_ctx.owned
                }, "保存商品", 8, ["disabled"])
              ])
            ], 40, ["onSubmit"])) : _ctx.modal === "addSku" ? (_openBlock(), _createElementBlock("form", {
              key: 1,
              class: "merchant-modal narrow",
              onSubmit: _withModifiers(_ctx.addSku, ["prevent"])
            }, [
              _createElementVNode("div", { class: "merchant-modal-header" }, [
                _createElementVNode("h2", null, "新增规格"),
                _createElementVNode("button", {
                  type: "button",
                  onClick: ($event) => _ctx.modal = "",
                  "aria-label": "关闭"
                }, [
                  _createVNode2(_component_Icon, {
                    name: "x",
                    size: 18
                  })
                ], 8, ["onClick"])
              ]),
              _createElementVNode("label", {
                class: "field-label",
                for: "merchant-field-8"
              }, "规格名称"),
              _withDirectives(_createElementVNode("input", {
                id: "merchant-field-8",
                class: "admin-input",
                maxlength: "100",
                "onUpdate:modelValue": ($event) => _ctx.skuForm.specKey = $event,
                required: "",
                placeholder: "例如：500ml"
              }, null, 8, ["onUpdate:modelValue"]), [
                [_vModelText, _ctx.skuForm.specKey]
              ]),
              _createElementVNode("label", {
                class: "field-label",
                for: "merchant-field-9"
              }, "售价（元）"),
              _withDirectives(_createElementVNode("input", {
                id: "merchant-field-9",
                class: "admin-input",
                "onUpdate:modelValue": ($event) => _ctx.skuForm.price = $event,
                inputmode: "decimal",
                required: "",
                placeholder: "0.00"
              }, null, 8, ["onUpdate:modelValue"]), [
                [_vModelText, _ctx.skuForm.price]
              ]),
              _createElementVNode("div", { class: "form-buttons" }, [
                _createElementVNode("button", {
                  type: "button",
                  class: "outline-button",
                  onClick: ($event) => _ctx.modal = ""
                }, "取消", 8, ["onClick"]),
                _createElementVNode("button", {
                  type: "submit",
                  class: "teal-button",
                  disabled: _ctx.preview || _ctx.saving
                }, "保存规格", 8, ["disabled"])
              ])
            ], 40, ["onSubmit"])) : _ctx.modal === "price" ? (_openBlock(), _createElementBlock("form", {
              key: 2,
              class: "merchant-modal narrow",
              onSubmit: _withModifiers(_ctx.savePrice, ["prevent"])
            }, [
              _createElementVNode("div", { class: "merchant-modal-header" }, [
                _createElementVNode("div", null, [
                  _createElementVNode("h2", null, "修改售价")
                ]),
                _createElementVNode("button", {
                  type: "button",
                  onClick: ($event) => _ctx.modal = "",
                  "aria-label": "关闭"
                }, [
                  _createVNode2(_component_Icon, {
                    name: "x",
                    size: 20
                  })
                ], 8, ["onClick"])
              ]),
              _createElementVNode(
                "div",
                { class: "field-muted" },
                _toDisplayString((_j = _ctx.selected) == null ? void 0 : _j.title) + " · " + _toDisplayString((_k = _ctx.activePriceSku) == null ? void 0 : _k.specKey),
                1
                /* TEXT */
              ),
              _createElementVNode("label", {
                class: "field-label",
                for: "merchant-field-10"
              }, "售价（元）"),
              _withDirectives(_createElementVNode("input", {
                id: "merchant-field-10",
                class: "admin-input",
                "onUpdate:modelValue": ($event) => _ctx.newPrice = $event,
                inputmode: "decimal",
                required: ""
              }, null, 8, ["onUpdate:modelValue"]), [
                [_vModelText, _ctx.newPrice]
              ]),
              _createElementVNode("div", { class: "form-buttons" }, [
                _createElementVNode("button", {
                  type: "button",
                  class: "outline-button",
                  onClick: ($event) => _ctx.modal = ""
                }, "取消", 8, ["onClick"]),
                _createElementVNode("button", {
                  type: "submit",
                  class: "teal-button",
                  disabled: _ctx.preview || _ctx.saving
                }, "保存售价", 8, ["disabled"])
              ])
            ], 40, ["onSubmit"])) : _createCommentVNode("v-if", true)
          ], 8, ["onClick"])), [
            [_directive_modal, () => _ctx.modal = ""]
          ]) : _createCommentVNode("v-if", true)
        ]);
      };
    })()
  };
  const _hoisted_1 = ["role", "aria-live"];
  const _hoisted_2 = {
    key: 0,
    class: "mini-spinner",
    "aria-hidden": "true"
  };
  const _hoisted_3 = { class: "status-panel-copy" };
  const _hoisted_4 = ["disabled"];
  const _sfc_main = /* @__PURE__ */ defineComponent({
    __name: "StatusPanel",
    props: {
      state: {},
      message: { default: "" },
      actionLabel: { default: "" },
      busy: { type: Boolean, default: false }
    },
    emits: ["retry"],
    setup(__props, { emit: __emit }) {
      const emit2 = __emit;
      return (_ctx, _cache) => {
        return openBlock(), createElementBlock("section", {
          class: normalizeClass(["status-panel surface-card", `status-panel--${__props.state}`]),
          role: __props.state === "error" ? "alert" : "status",
          "aria-live": __props.state === "error" ? "assertive" : "polite"
        }, [
          __props.state === "loading" ? (openBlock(), createElementBlock("span", _hoisted_2)) : (openBlock(), createBlock(unref(Icon), {
            key: 1,
            name: __props.state === "error" ? "alert" : "order",
            size: 26,
            "aria-hidden": "true"
          }, null, 8, ["name"])),
          createBaseVNode("div", _hoisted_3, [
            createBaseVNode(
              "strong",
              null,
              toDisplayString(__props.state === "loading" ? __props.message || "正在加载…" : __props.message),
              1
              /* TEXT */
            )
          ]),
          __props.actionLabel && __props.state !== "loading" ? (openBlock(), createElementBlock("button", {
            key: 2,
            type: "button",
            class: "outline-button",
            disabled: __props.busy,
            onClick: _cache[0] || (_cache[0] = ($event) => emit2("retry"))
          }, toDisplayString(__props.actionLabel), 9, _hoisted_4)) : createCommentVNode("v-if", true)
        ], 10, _hoisted_1);
      };
    }
  });
  const { ref: ref$a, computed: computed$a, onMounted: onMounted$9, watch: watch$8 } = Vue;
  const ProductDetail = {
    name: "ProductDetail",
    components: { ConsumerShell, ProductImage, StatusPanel: _sfc_main },
    setup() {
      const scope = requestScope();
      const product = ref$a(null), chosen = ref$a(""), count = ref$a(1), busy = ref$a(false), loading = ref$a(true), error = ref$a(""), errorCode = ref$a(""), imageIndex = ref$a(0), touchStartX = ref$a(null);
      const id = computed$a(() => safeDecodeId(store.route.split("/")[2] || ""));
      const sku2 = computed$a(
        () => {
          var _a, _b;
          return ((_b = (_a = product.value) == null ? void 0 : _a.skus) == null ? void 0 : _b.find((s) => s.skuId === chosen.value)) || skuOf(product.value);
        }
      );
      const merchant = computed$a(
        () => store.merchants.find((m) => {
          var _a;
          return m.merchantId === ((_a = product.value) == null ? void 0 : _a.merchantId);
        }) || {}
      );
      const detailImages = computed$a(
        () => {
          var _a, _b, _c;
          return ((_b = (_a = product.value) == null ? void 0 : _a.images) == null ? void 0 : _b.length) ? product.value.images : [{ url: ((_c = product.value) == null ? void 0 : _c.imageUrl) || "" }];
        }
      );
      const errorText = computed$a(() => {
        if (errorCode.value === "C0001") return "该商品已下架或暂不可售";
        if (errorCode.value === "G0001") return "商品不存在或已删除";
        if (!errorCode.value || ["NETWORK", "TIMEOUT", "RESPONSE"].includes(errorCode.value))
          return "商品加载失败，请检查网络后重试";
        return error.value || "商品加载失败，请重试";
      });
      async function load() {
        const request2 = scope.begin();
        const target = id.value;
        product.value = null;
        error.value = "";
        errorCode.value = "";
        loading.value = true;
        try {
          if (preview) {
            product.value = store.products.find((p2) => p2.productId === target) || null;
          } else {
            if (!target) throw Error("无效商品地址");
            const p2 = await api("/products/" + pathId(target), { signal: request2.signal });
            if (request2.current()) product.value = p2;
          }
        } catch (e) {
          if (request2.current()) {
            error.value = e.message;
            errorCode.value = e.code || "";
          }
        } finally {
          if (request2.current()) loading.value = false;
        }
        if (!request2.current()) return;
        chosen.value = skuOf(product.value).skuId || "";
        imageIndex.value = 0;
        count.value = 1;
      }
      onMounted$9(load);
      async function add() {
        var _a;
        if (preview || busy.value || !((_a = sku2.value) == null ? void 0 : _a.skuId)) return;
        const current = scope.capture(), productId = product.value.productId, skuId = sku2.value.skuId, requested = Number(count.value);
        busy.value = true;
        try {
          const actual = await api("/products/" + pathId(productId));
          const real = actual.skus.find((s) => s.skuId === skuId);
          if (actual.status !== "PUBLISHED" || !real || real.status !== "ACTIVE" || Number(real.available) < requested)
            throw Error("商品库存或状态已变化");
          if (!current()) return;
          await api("/cart", { method: "POST", body: { skuId: real.skuId, quantity: requested } });
          if (current()) notify("已加入购物车");
        } catch (e) {
          if (current()) notify(e.message);
        } finally {
          if (current()) busy.value = false;
        }
      }
      function touchStart(event) {
        var _a, _b;
        touchStartX.value = ((_b = (_a = event.touches) == null ? void 0 : _a[0]) == null ? void 0 : _b.clientX) ?? null;
      }
      function touchEnd(event) {
        var _a, _b;
        if (touchStartX.value == null || detailImages.value.length < 2) return;
        const end = (_b = (_a = event.changedTouches) == null ? void 0 : _a[0]) == null ? void 0 : _b.clientX;
        const delta = typeof end === "number" ? end - touchStartX.value : 0;
        touchStartX.value = null;
        if (Math.abs(delta) < 36) return;
        imageIndex.value = delta < 0 ? (imageIndex.value + 1) % detailImages.value.length : (imageIndex.value + detailImages.value.length - 1) % detailImages.value.length;
      }
      return {
        product,
        sku: sku2,
        chosen,
        count,
        busy,
        loading,
        error,
        errorText,
        preview,
        store,
        go,
        money,
        merchant,
        add,
        load,
        pathId,
        imageIndex,
        touchStart,
        touchEnd,
        detailImages
      };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode2, createElementVNode: _createElementVNode, openBlock: _openBlock, createBlock: _createBlock, createCommentVNode: _createCommentVNode, createElementBlock: _createElementBlock, renderList: _renderList, Fragment: _Fragment, normalizeClass: _normalizeClass, toDisplayString: _toDisplayString, createTextVNode: _createTextVNode, withCtx: _withCtx } = Vue;
      return function render2(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_StatusPanel = _resolveComponent("StatusPanel");
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_ConsumerShell = _resolveComponent("ConsumerShell");
        return _openBlock(), _createBlock(_component_ConsumerShell, { active: "home" }, {
          default: _withCtx(() => [
            _createElementVNode("div", { class: "mobile-page-top" }, [
              _createElementVNode("button", {
                onClick: ($event) => _ctx.go("/"),
                "aria-label": "返回首页"
              }, [
                _createVNode2(_component_Icon, { name: "arrowLeft" })
              ], 8, ["onClick"]),
              _createElementVNode("b", null, "商品详情"),
              _createElementVNode("button", {
                onClick: ($event) => _ctx.go("/cart"),
                "aria-label": "购物车"
              }, [
                _createVNode2(_component_Icon, { name: "cart" })
              ], 8, ["onClick"])
            ]),
            _ctx.loading ? (_openBlock(), _createBlock(_component_StatusPanel, {
              key: 0,
              state: "loading",
              message: "正在加载商品…"
            })) : _ctx.error ? (_openBlock(), _createBlock(_component_StatusPanel, {
              key: 1,
              state: "error",
              message: _ctx.errorText,
              "action-label": "重新加载",
              busy: _ctx.loading,
              onRetry: _ctx.load
            }, null, 8, ["message", "busy", "onRetry"])) : _ctx.product ? (_openBlock(), _createElementBlock(
              _Fragment,
              { key: 2 },
              [
                _createElementVNode("div", {
                  class: "detail-art",
                  onTouchstartPassive: _ctx.touchStart,
                  onTouchendPassive: _ctx.touchEnd
                }, [
                  _createVNode2(_component_ProductImage, {
                    src: _ctx.detailImages[_ctx.imageIndex].url,
                    alt: _ctx.product.title,
                    loading: "eager"
                  }, null, 8, ["src", "alt"]),
                  _ctx.detailImages.length > 1 ? (_openBlock(), _createElementBlock("button", {
                    key: 0,
                    class: "detail-image-prev",
                    "aria-label": "上一张",
                    onClick: ($event) => _ctx.imageIndex = (_ctx.imageIndex + _ctx.detailImages.length - 1) % _ctx.detailImages.length
                  }, "‹", 8, ["onClick"])) : _createCommentVNode("v-if", true),
                  _ctx.detailImages.length > 1 ? (_openBlock(), _createElementBlock("button", {
                    key: 1,
                    class: "detail-image-next",
                    "aria-label": "下一张",
                    onClick: ($event) => _ctx.imageIndex = (_ctx.imageIndex + 1) % _ctx.detailImages.length
                  }, "›", 8, ["onClick"])) : _createCommentVNode("v-if", true),
                  _ctx.detailImages.length > 1 ? (_openBlock(), _createElementBlock("div", {
                    key: 2,
                    class: "detail-image-thumbs"
                  }, [
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.detailImages, (img, i) => {
                        return _openBlock(), _createElementBlock("button", {
                          key: img.imageId || img.url,
                          class: _normalizeClass({ active: i === _ctx.imageIndex }),
                          onClick: ($event) => _ctx.imageIndex = i
                        }, [
                          _createVNode2(_component_ProductImage, {
                            src: img.url,
                            alt: _ctx.product.title
                          }, null, 8, ["src", "alt"])
                        ], 10, ["onClick"]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ])) : _createCommentVNode("v-if", true),
                  _ctx.product.status === "PUBLISHED" ? (_openBlock(), _createElementBlock("span", {
                    key: 3,
                    class: "corner-tag"
                  }, "校内自提")) : _createCommentVNode("v-if", true)
                ], 40, ["onTouchstartPassive", "onTouchendPassive"]),
                _createElementVNode("div", { class: "detail-info" }, [
                  _createElementVNode("div", { class: "detail-price" }, [
                    _createTextVNode(
                      _toDisplayString(_ctx.money(_ctx.sku.priceCent)) + " ",
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("small", null, "含税售价")
                  ]),
                  _createElementVNode(
                    "h1",
                    null,
                    _toDisplayString(_ctx.product.title),
                    1
                    /* TEXT */
                  ),
                  _ctx.product.description ? (_openBlock(), _createElementBlock(
                    "p",
                    {
                      key: 0,
                      class: "muted-short"
                    },
                    _toDisplayString(_ctx.product.description),
                    1
                    /* TEXT */
                  )) : _createCommentVNode("v-if", true)
                ]),
                _createElementVNode("div", { class: "detail-card" }, [
                  _createElementVNode("button", {
                    class: "detail-merchant",
                    onClick: ($event) => _ctx.go("/shops/" + _ctx.pathId(_ctx.product.merchantId))
                  }, [
                    _createElementVNode("span", { class: "merchant-logo" }, [
                      _createVNode2(_component_Icon, { name: "store" })
                    ]),
                    _createElementVNode("div", null, [
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.product.merchantName || _ctx.merchant.name || "校园商户"),
                        1
                        /* TEXT */
                      ),
                      _createElementVNode(
                        "span",
                        null,
                        _toDisplayString(_ctx.merchant.storeName || _ctx.merchant.location || "校内自提门店"),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createVNode2(_component_Icon, { name: "chevronRight" })
                  ], 8, ["onClick"])
                ]),
                _createElementVNode("div", { class: "detail-card" }, [
                  _createElementVNode("div", { class: "detail-subtitle" }, "选择规格"),
                  _createElementVNode("div", { class: "sku-picker" }, [
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.product.skus, (s) => {
                        return _openBlock(), _createElementBlock("button", {
                          key: s.skuId,
                          class: _normalizeClass({ active: _ctx.sku.skuId === s.skuId }),
                          "aria-pressed": _ctx.sku.skuId === s.skuId,
                          disabled: _ctx.busy || s.status !== "ACTIVE" || Number(s.available) <= 0,
                          onClick: ($event) => {
                            _ctx.chosen = s.skuId;
                            _ctx.count = 1;
                          }
                        }, [
                          _createTextVNode(
                            _toDisplayString(s.specKey),
                            1
                            /* TEXT */
                          ),
                          s.status !== "ACTIVE" ? (_openBlock(), _createElementBlock("small", {
                            key: 0,
                            class: "sku-state"
                          }, "已下架")) : Number(s.available) <= 0 ? (_openBlock(), _createElementBlock("small", {
                            key: 1,
                            class: "sku-state"
                          }, "无货")) : _createCommentVNode("v-if", true)
                        ], 10, ["aria-pressed", "disabled", "onClick"]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ]),
                  _createElementVNode("div", { class: "quantity-picker" }, [
                    _createElementVNode("span", null, [
                      _createTextVNode("数量 "),
                      _createElementVNode(
                        "small",
                        null,
                        "可售 " + _toDisplayString(_ctx.sku.available || 0),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createElementVNode("div", null, [
                      _createElementVNode("button", {
                        "aria-label": "减少",
                        disabled: _ctx.busy,
                        onClick: ($event) => _ctx.count = Math.max(1, _ctx.count - 1)
                      }, [
                        _createVNode2(_component_Icon, {
                          name: "minus",
                          size: 16
                        })
                      ], 8, ["disabled", "onClick"]),
                      _createElementVNode(
                        "b",
                        null,
                        _toDisplayString(_ctx.count),
                        1
                        /* TEXT */
                      ),
                      _createElementVNode("button", {
                        "aria-label": "增加",
                        disabled: _ctx.busy || _ctx.count >= Math.min(99, Number(_ctx.sku.available || 0)),
                        onClick: ($event) => _ctx.count++
                      }, [
                        _createVNode2(_component_Icon, {
                          name: "plus",
                          size: 16
                        })
                      ], 8, ["disabled", "onClick"])
                    ])
                  ])
                ]),
                _createElementVNode("div", { class: "detail-fixed" }, [
                  _createElementVNode("button", {
                    class: "outline-button",
                    onClick: ($event) => _ctx.go("/cart")
                  }, [
                    _createVNode2(_component_Icon, {
                      name: "cart",
                      size: 18
                    }),
                    _createTextVNode("购物车")
                  ], 8, ["onClick"]),
                  _createElementVNode("button", {
                    class: "teal-button",
                    disabled: _ctx.preview || _ctx.busy || _ctx.sku.status !== "ACTIVE" || Number(_ctx.sku.available || 0) <= 0 || _ctx.product.status !== "PUBLISHED",
                    onClick: _ctx.add
                  }, _toDisplayString(_ctx.busy ? "加入中…" : "加入购物车"), 9, ["disabled", "onClick"])
                ])
              ],
              64
              /* STABLE_FRAGMENT */
            )) : (_openBlock(), _createBlock(_component_StatusPanel, {
              key: 3,
              state: "empty",
              message: "未找到商品"
            }))
          ]),
          _: 1
          /* STABLE */
        });
      };
    })()
  };
  const { ref: ref$9, computed: computed$9, onMounted: onMounted$8, onUnmounted: onUnmounted$6, watch: watch$7 } = Vue;
  const Shop = {
    name: "Shop",
    components: { ConsumerShell, ProductImage },
    setup() {
      const merchant = ref$9(null), products = ref$9([]), error = ref$9(""), loading = ref$9(false), page = ref$9(1), hasNext = ref$9(false);
      const id = computed$9(
        () => safeDecodeId(store.route.slice("/shops/".length).split("/")[0] || "")
      );
      let loadVersion = 0;
      async function load() {
        var _a;
        const stamp = ++loadVersion, current = id.value, currentPage = page.value;
        const valid = () => stamp === loadVersion && current === id.value && currentPage === page.value;
        error.value = "";
        loading.value = true;
        if (((_a = merchant.value) == null ? void 0 : _a.merchantId) !== current) merchant.value = null;
        products.value = [];
        hasNext.value = false;
        try {
          if (preview) {
            merchant.value = store.merchants.find((m) => m.merchantId === current) || null;
            const all = store.products.filter(
              (p2) => p2.merchantId === current && p2.status === "PUBLISHED"
            );
            products.value = all.slice((currentPage - 1) * 12, currentPage * 12);
            hasNext.value = all.length > currentPage * 12;
          } else {
            const [m, p2] = await Promise.all([
              merchant.value ? Promise.resolve(merchant.value) : api("/merchants/public/" + encodeURIComponent(current)),
              api("/products/page" + query({ merchantId: current, page: currentPage, size: 12 }))
            ]);
            if (!valid()) return;
            merchant.value = m;
            products.value = (p2 == null ? void 0 : p2.items) || [];
            hasNext.value = !!(p2 == null ? void 0 : p2.hasNext);
          }
        } catch (e) {
          if (valid()) error.value = e.message;
        } finally {
          if (valid()) loading.value = false;
        }
      }
      onMounted$8(load);
      onUnmounted$6(() => ++loadVersion);
      watch$7(page, load);
      return { merchant, products, error, loading, page, hasNext, go, money, skuOf };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode2, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, createBlock: _createBlock, createTextVNode: _createTextVNode, renderList: _renderList, Fragment: _Fragment, withCtx: _withCtx } = Vue;
      return function render2(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_ConsumerShell = _resolveComponent("ConsumerShell");
        return _openBlock(), _createBlock(_component_ConsumerShell, { active: "home" }, {
          default: _withCtx(() => [
            _createElementVNode("div", { class: "mobile-page-top" }, [
              _createElementVNode("button", {
                onClick: ($event) => _ctx.go("/"),
                "aria-label": "返回"
              }, [
                _createVNode2(_component_Icon, { name: "arrowLeft" })
              ], 8, ["onClick"]),
              _createElementVNode("b", null, "商户"),
              _createElementVNode("span")
            ]),
            _ctx.error ? (_openBlock(), _createElementBlock(
              "div",
              {
                key: 0,
                class: "inline-error"
              },
              _toDisplayString(_ctx.error),
              1
              /* TEXT */
            )) : _createCommentVNode("v-if", true),
            _ctx.merchant ? (_openBlock(), _createElementBlock(
              _Fragment,
              { key: 1 },
              [
                _createElementVNode("section", { class: "shop-hero" }, [
                  _ctx.merchant.imageUrl ? (_openBlock(), _createBlock(_component_ProductImage, {
                    key: 0,
                    class: "shop-hero-image",
                    src: _ctx.merchant.imageUrl,
                    alt: _ctx.merchant.name + "门店图片"
                  }, null, 8, ["src", "alt"])) : (_openBlock(), _createElementBlock("span", {
                    key: 1,
                    class: "merchant-logo"
                  }, [
                    _createVNode2(_component_Icon, {
                      name: "store",
                      size: 28
                    })
                  ])),
                  _createElementVNode("div", null, [
                    _createElementVNode(
                      "h1",
                      null,
                      _toDisplayString(_ctx.merchant.name),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode(
                      "p",
                      null,
                      _toDisplayString(_ctx.merchant.storeName) + " · " + _toDisplayString(_ctx.merchant.location),
                      1
                      /* TEXT */
                    )
                  ])
                ]),
                _createElementVNode("section", { class: "detail-card shop-intro" }, [
                  _createElementVNode("h2", null, "门店介绍"),
                  _ctx.merchant.description ? (_openBlock(), _createElementBlock(
                    "p",
                    { key: 0 },
                    _toDisplayString(_ctx.merchant.description),
                    1
                    /* TEXT */
                  )) : (_openBlock(), _createElementBlock("p", {
                    key: 1,
                    class: "muted-short"
                  }, "未填写")),
                  _createElementVNode("h2", null, "营业时间"),
                  _ctx.merchant.businessHours ? (_openBlock(), _createElementBlock("p", { key: 2 }, [
                    _createTextVNode(
                      _toDisplayString(_ctx.merchant.businessHours) + " ",
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("small", null, "（北京时间）")
                  ])) : (_openBlock(), _createElementBlock("p", {
                    key: 3,
                    class: "muted-short"
                  }, "未填写"))
                ]),
                _createElementVNode("div", { class: "section-heading" }, [
                  _createElementVNode("h2", null, "在售商品")
                ]),
                _createElementVNode("div", { class: "shop-product-grid" }, [
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(_ctx.products, (p2) => {
                      return _openBlock(), _createElementBlock("button", {
                        key: p2.productId,
                        class: "shop-product-card",
                        onClick: ($event) => _ctx.go("/product/" + encodeURIComponent(p2.productId))
                      }, [
                        _createVNode2(_component_ProductImage, {
                          src: p2.imageUrl,
                          alt: p2.title
                        }, null, 8, ["src", "alt"]),
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(p2.title),
                          1
                          /* TEXT */
                        ),
                        _createElementVNode(
                          "span",
                          null,
                          _toDisplayString(_ctx.money(_ctx.skuOf(p2).priceCent)),
                          1
                          /* TEXT */
                        )
                      ], 8, ["onClick"]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ]),
                !_ctx.products.length && !_ctx.loading ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "mobile-empty"
                }, "暂无在售商品")) : _createCommentVNode("v-if", true),
                _createElementVNode("div", { class: "shop-pagination" }, [
                  _createElementVNode("button", {
                    disabled: _ctx.page === 1 || _ctx.loading,
                    onClick: ($event) => _ctx.page--
                  }, "上一页", 8, ["disabled", "onClick"]),
                  _createElementVNode(
                    "span",
                    null,
                    _toDisplayString(_ctx.page),
                    1
                    /* TEXT */
                  ),
                  _createElementVNode("button", {
                    disabled: !_ctx.hasNext || _ctx.loading,
                    onClick: ($event) => _ctx.page++
                  }, "下一页", 8, ["disabled", "onClick"])
                ])
              ],
              64
              /* STABLE_FRAGMENT */
            )) : _ctx.loading ? (_openBlock(), _createElementBlock("div", {
              key: 2,
              class: "mobile-empty"
            }, "正在加载商户…")) : _createCommentVNode("v-if", true)
          ]),
          _: 1
          /* STABLE */
        });
      };
    })()
  };
  const t = "2026-10-27T11:40:00Z";
  const items = [
    {
      skuId: "preview-sku-1",
      title: "红烧牛肉面 · 经典桶",
      specKey: "109g",
      unitPriceCent: 450,
      quantity: 1
    },
    {
      skuId: "preview-sku-2",
      title: "纯牛奶 · 250ml",
      specKey: "250ml",
      unitPriceCent: 280,
      quantity: 2
    }
  ];
  const DEMO_CART = [
    {
      merchantId: "preview-m1",
      skuId: "preview-sku-1",
      title: items[0].title,
      specKey: "109g",
      quantity: 1,
      priceCent: 450,
      quoteVersion: 1,
      available: 320,
      sellable: true
    },
    {
      merchantId: "preview-m1",
      skuId: "preview-sku-2",
      title: items[1].title,
      specKey: "250ml",
      quantity: 2,
      priceCent: 280,
      quoteVersion: 1,
      available: 18,
      sellable: true
    },
    {
      merchantId: "preview-m2",
      skuId: "preview-sku-3",
      title: "苹果 · 清甜脆爽",
      specKey: "单个",
      quantity: 2,
      priceCent: 190,
      quoteVersion: 1,
      available: 46,
      sellable: true
    }
  ];
  const DEMO_ORDERS = [
    {
      orderId: "CS202610280001",
      buyerId: "preview-user",
      merchantId: "preview-m1",
      storeId: "preview-s1",
      status: "PAID",
      totalCent: 1010,
      createdAt: t,
      deadline: "2026-10-29T11:40:00Z",
      items,
      pickup: { status: "READY", expiresAt: null }
    },
    {
      orderId: "CS202610270016",
      buyerId: "preview-user",
      merchantId: "preview-m2",
      storeId: "preview-s2",
      status: "COMPLETED",
      totalCent: 570,
      createdAt: "2026-10-26T10:30:00Z",
      items: [
        {
          skuId: "preview-sku-3",
          title: "苹果 · 清甜脆爽",
          specKey: "单个",
          unitPriceCent: 190,
          quantity: 3
        }
      ],
      pickup: { status: "COMPLETED" }
    },
    {
      orderId: "CS202610280003",
      buyerId: "preview-user",
      merchantId: "preview-m1",
      storeId: "preview-s1",
      status: "PENDING_PAYMENT",
      totalCent: 450,
      createdAt: t,
      deadline: "2026-10-29T11:40:00Z",
      items: items.slice(0, 1),
      pickup: null
    }
  ];
  const DEMO_APPLICATIONS = [
    {
      applicationId: "AP-1025",
      merchantName: "东湖便利",
      category: "便利零售",
      contactName: "店主 A",
      contactPhone: "13800000000",
      storeName: "学一食堂店",
      location: "东湖校区 · 学一食堂",
      status: "SUBMITTED",
      rejectionReason: ""
    },
    {
      applicationId: "AP-1024",
      merchantName: "青果时间",
      category: "水果生鲜",
      contactName: "店主 B",
      contactPhone: "13900000000",
      storeName: "生活区店",
      location: "生活区 B 栋",
      status: "APPROVED",
      merchantId: "preview-m2"
    },
    {
      applicationId: "AP-1023",
      merchantName: "学伴文具",
      category: "文具用品",
      contactName: "店主 C",
      contactPhone: "13600000000",
      storeName: "图书馆店",
      location: "图书馆一层",
      status: "REJECTED",
      rejectionReason: "信息不完整"
    }
  ];
  const DEMO_MEMBERS = [
    { merchantId: "preview-m1", userId: "preview-user", role: "OWNER", status: "ACTIVE" },
    { merchantId: "preview-m1", userId: "preview-clerk", role: "CLERK", status: "ACTIVE" }
  ];
  const DEMO_BASES = [
    { id: "KB-01", name: "门店服务指南", merchantId: "preview-m1", visibility: "PUBLIC" },
    { id: "KB-02", name: "内部运营指引", merchantId: "preview-m1", visibility: "MERCHANT_INTERNAL" }
  ];
  const DEMO_DOCS = [
    {
      id: "D-11",
      baseId: "KB-01",
      rootId: "R-11",
      title: "门店营业信息",
      version: 2,
      status: "PUBLISHED",
      indexStatus: "READY",
      content: "营业时间与自提注意事项",
      createdAt: t
    },
    {
      id: "D-12",
      baseId: "KB-01",
      rootId: "R-12",
      title: "商品分类说明",
      version: 1,
      status: "DRAFT",
      indexStatus: "READY",
      content: "零食与饮品",
      createdAt: t
    }
  ];
  const DEMO_STATS = {
    totalOrders: 168,
    pendingCount: 12,
    paidCount: 28,
    completedCount: 128,
    refundedCount: 3,
    completedAmountCent: 286050
  };
  const DEMO_MERCHANT_ORDERS = DEMO_ORDERS.map((o, i) => ({
    ...o,
    orderId: "M" + String(i + 1).padStart(5, "0"),
    buyerId: "preview-buyer-" + i,
    merchantId: "preview-m1",
    status: ["PAID", "COMPLETED", "PENDING_PAYMENT"][i],
    pickup: i === 0 ? { status: "WAIT_PREP" } : o.pickup
  }));
  const DEMO_AFTERSALES = [
    {
      id: "AF-008",
      orderId: "M00002",
      merchantId: "preview-m1",
      status: "REQUESTED",
      reason: "商品临时不需要",
      createdAt: t
    },
    {
      id: "AF-007",
      orderId: "M00003",
      merchantId: "preview-m1",
      status: "DISPUTED",
      reason: "未提货申请退款",
      createdAt: t
    }
  ];
  const DEMO_STOCK_MOVES = [
    {
      id: "MV-11",
      skuId: DEMO_PRODUCTS[0].skus[0].skuId,
      type: "REPLENISH",
      quantity: 20,
      createdAt: t,
      bizKey: "DEMO-01"
    }
  ];
  const RBAC_LABELS = [
    ["dashboard.read", "经营统计"],
    ["product.read", "查看商品"],
    ["product.write", "管理商品及价格"],
    ["stock.read", "查看库存与流水"],
    ["stock.replenish", "补货"],
    ["order.read", "查看订单"],
    ["order.prepare", "备货"],
    ["pickup.verify", "自提核销"],
    ["aftersale.read", "查看售后"],
    ["aftersale.review", "审核售后"],
    ["knowledge.read", "读取知识库"],
    ["knowledge.manage", "管理知识库"],
    ["team.manage", "邀请和撤销成员"],
    ["store.manage", "修改门店资料"],
    ["role.manage", "角色与权限管理"]
  ];
  const DEMO_RBAC_PERMISSIONS = RBAC_LABELS.map(([code, label]) => ({
    code,
    label,
    grantable: !["team.manage", "store.manage", "role.manage"].includes(code)
  }));
  const DEMO_RBAC_ROLES = [
    { code: "OWNER", name: "经营者", builtin: true, permissions: RBAC_LABELS.map(([code]) => code) },
    {
      code: "CLERK",
      name: "店员",
      builtin: true,
      permissions: [
        "product.read",
        "stock.read",
        "stock.replenish",
        "order.read",
        "order.prepare",
        "pickup.verify"
      ]
    },
    {
      code: "preview-operator",
      name: "商品运营",
      builtin: false,
      permissions: ["product.read", "product.write", "stock.read"]
    }
  ];
  const { ref: ref$8, computed: computed$8, onMounted: onMounted$7 } = Vue;
  const Cart = {
    name: "Cart",
    components: { ConsumerShell, ProductImage, StatusPanel: _sfc_main },
    setup() {
      const scope = requestScope();
      const items2 = ref$8([]), merchantId = ref$8(""), busy = ref$8(false), loading = ref$8(true), error = ref$8(""), orderKey = ref$8(""), fingerprint = ref$8(""), confirmOpen = ref$8(false), confirmLoading = ref$8(false), confirmError = ref$8(""), confirmRetryable = ref$8(false), confirmItems = ref$8([]), confirmMerchant = ref$8({}), confirmTotal = ref$8(0);
      let confirmVersion = 0;
      const groups = computed$8(
        () => Object.entries(
          Object.groupBy ? Object.groupBy(items2.value, (i) => i.merchantId) : items2.value.reduce((a, i) => {
            var _a;
            (a[_a = i.merchantId] ?? (a[_a] = [])).push(i);
            return a;
          }, {})
        ).map(([id, rows]) => ({
          id,
          rows,
          total: rows.reduce((s, i) => s + Number(i.priceCent) * Number(i.quantity), 0)
        }))
      );
      const selected = computed$8(() => items2.value.filter((i) => i.merchantId === merchantId.value));
      const total = computed$8(
        () => selected.value.reduce((n, i) => n + Number(i.priceCent) * Number(i.quantity), 0)
      );
      const merchantName = (id) => {
        var _a, _b;
        return ((_a = items2.value.find((i) => i.merchantId === id)) == null ? void 0 : _a.merchantName) || ((_b = store.merchants.find((m) => m.merchantId === id)) == null ? void 0 : _b.name) || "校内商户";
      };
      async function load() {
        var _a;
        const request2 = scope.begin();
        loading.value = true;
        error.value = "";
        if (preview) {
          items2.value = DEMO_CART.map((i) => ({ ...i }));
        } else {
          try {
            const result = await api("/cart", { signal: request2.signal });
            if (!request2.current()) return;
            items2.value = result || [];
          } catch (e) {
            if (!request2.current()) return;
            error.value = e.message;
            items2.value = [];
          }
        }
        if (!request2.current()) return;
        loading.value = false;
        if (!items2.value.some((i) => i.merchantId === merchantId.value))
          merchantId.value = ((_a = items2.value[0]) == null ? void 0 : _a.merchantId) || "";
      }
      onMounted$7(load);
      async function quantity(i, d) {
        if (preview || busy.value || loading.value) return;
        const current = scope.capture();
        const n = Number(i.quantity) + d;
        if (n > 99 || n < 0 || d > 0 && (!i.sellable || n > i.available)) return;
        busy.value = true;
        try {
          if (n) await api("/cart", { method: "PUT", body: { skuId: i.skuId, quantity: n } });
          else await api("/cart/" + pathId(i.skuId), { method: "DELETE" });
          if (!current()) return;
          orderKey.value = "";
          fingerprint.value = "";
          await load();
        } catch (e) {
          if (current()) notify(e.message);
        } finally {
          if (current()) busy.value = false;
        }
      }
      function checkout() {
        if (preview || busy.value || loading.value || !selected.value.length) return;
        if (selected.value.length > 20) {
          notify("每笔订单最多支持20个SKU行，请减少商品规格后结算");
          return;
        }
        if (selected.value.some((i) => !i.sellable || i.available < i.quantity)) {
          notify("请先调整失效或库存不足的商品");
          return;
        }
        confirmOpen.value = true;
        loadConfirmation();
      }
      async function loadConfirmation() {
        const stamp = ++confirmVersion, merchant = merchantId.value;
        confirmLoading.value = true;
        confirmError.value = "";
        confirmRetryable.value = false;
        confirmItems.value = [];
        confirmTotal.value = 0;
        try {
          const [cart, shop] = await Promise.all([
            api("/cart"),
            api("/merchants/public/" + pathId(merchant))
          ]);
          if (stamp !== confirmVersion) return;
          const rows = (cart || []).filter((i) => i.merchantId === merchant);
          confirmMerchant.value = shop || {};
          confirmItems.value = rows;
          confirmTotal.value = rows.reduce(
            (sum, i) => sum + Number(i.priceCent) * Number(i.quantity),
            0
          );
          if (!rows.length) confirmError.value = "购物车中已没有该商户的商品，请返回调整";
          else if (rows.some((i) => !i.sellable || i.available < i.quantity))
            confirmError.value = "部分商品库存不足或已失效，请返回调整后重新确认";
        } catch (e) {
          if (stamp === confirmVersion) confirmError.value = e.message;
        } finally {
          if (stamp === confirmVersion) confirmLoading.value = false;
        }
      }
      function closeConfirm() {
        if (busy.value) return;
        ++confirmVersion;
        confirmOpen.value = false;
        confirmLoading.value = false;
        confirmError.value = "";
        confirmRetryable.value = false;
        confirmItems.value = [];
        confirmMerchant.value = {};
        confirmTotal.value = 0;
      }
      async function confirmCheckout() {
        if (preview || busy.value || confirmLoading.value || confirmError.value) return;
        if (!confirmItems.value.length || confirmItems.value.length > 20) return;
        if (confirmItems.value.some(
          (i) => !i.sellable || !positiveInt(i.quantity, 99) || i.quantity > i.available
        )) {
          confirmError.value = "部分商品库存不足或已失效，请刷新确认信息";
          return;
        }
        const body = {
          merchantId: merchantId.value,
          items: confirmItems.value.map((i) => ({
            skuId: i.skuId,
            quantity: Number(i.quantity),
            expectedPriceCent: Number(i.priceCent),
            expectedVersion: Number(i.quoteVersion)
          }))
        };
        const next = JSON.stringify(body);
        if (!orderKey.value || fingerprint.value !== next) {
          orderKey.value = idempotency();
          fingerprint.value = next;
        }
        const current = scope.capture();
        busy.value = true;
        confirmRetryable.value = false;
        try {
          const created = await api("/orders", { method: "POST", body, key: orderKey.value });
          if (!current()) return;
          orderKey.value = "";
          fingerprint.value = "";
          confirmRetryable.value = false;
          confirmOpen.value = false;
          notify("订单已创建");
          go("/orders/" + pathId(created.orderId));
        } catch (e) {
          if (current()) {
            const indeterminate = ["NETWORK", "TIMEOUT", "RESPONSE"].includes(e.code) || Number(e.status) >= 500;
            confirmRetryable.value = indeterminate;
            confirmError.value = indeterminate ? "" : e.message;
            if (indeterminate) notify("提交结果未知，可直接重试；同一内容不会重复下单");
          }
        } finally {
          if (current()) busy.value = false;
        }
      }
      return {
        items: items2,
        loading,
        merchantId,
        busy,
        error,
        groups,
        selected,
        total,
        preview,
        go,
        money,
        merchantName,
        quantity,
        remove: (i) => quantity(i, -Number(i.quantity)),
        orderKey,
        confirmOpen,
        confirmLoading,
        confirmRetryable,
        confirmError,
        confirmItems,
        confirmMerchant,
        confirmTotal,
        loadConfirmation,
        closeConfirm,
        confirmCheckout,
        checkout,
        load
      };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode2, createElementVNode: _createElementVNode, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, toDisplayString: _toDisplayString, renderList: _renderList, Fragment: _Fragment, normalizeClass: _normalizeClass, createTextVNode: _createTextVNode, createBlock: _createBlock, withModifiers: _withModifiers, resolveDirective: _resolveDirective, withDirectives: _withDirectives, withCtx: _withCtx } = Vue;
      return function render2(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_StatusPanel = _resolveComponent("StatusPanel");
        const _component_ConsumerShell = _resolveComponent("ConsumerShell");
        const _directive_modal = _resolveDirective("modal");
        return _openBlock(), _createBlock(_component_ConsumerShell, { active: "cart" }, {
          default: _withCtx(() => [
            _createElementVNode("div", { class: "mobile-page-top" }, [
              _createElementVNode("button", {
                onClick: ($event) => _ctx.go("/"),
                "aria-label": "返回"
              }, [
                _createVNode2(_component_Icon, { name: "arrowLeft" })
              ], 8, ["onClick"]),
              _createElementVNode("b", null, "购物车"),
              _createElementVNode("button", {
                disabled: _ctx.busy || _ctx.loading,
                onClick: _ctx.load,
                "aria-label": "刷新"
              }, [
                _createVNode2(_component_Icon, { name: "refresh" })
              ], 8, ["disabled", "onClick"])
            ]),
            _ctx.loading ? (_openBlock(), _createElementBlock("div", {
              key: 0,
              role: "status",
              class: "inline-loading"
            }, "正在加载购物车…")) : _createCommentVNode("v-if", true),
            _ctx.error ? (_openBlock(), _createElementBlock(
              "div",
              {
                key: 1,
                class: "inline-error"
              },
              _toDisplayString(_ctx.error),
              1
              /* TEXT */
            )) : _createCommentVNode("v-if", true),
            !_ctx.loading && !_ctx.items.length && !_ctx.error ? (_openBlock(), _createElementBlock("div", {
              key: 2,
              class: "mobile-empty"
            }, [
              _createVNode2(_component_Icon, {
                name: "cart",
                size: 36
              }),
              _createElementVNode("strong", null, "购物车空空的"),
              _createElementVNode("button", {
                class: "teal-button",
                onClick: ($event) => _ctx.go("/")
              }, "去逛逛", 8, ["onClick"])
            ])) : _createCommentVNode("v-if", true),
            (_openBlock(true), _createElementBlock(
              _Fragment,
              null,
              _renderList(_ctx.groups, (g) => {
                return _openBlock(), _createElementBlock(
                  "section",
                  {
                    key: g.id,
                    class: _normalizeClass(["cart-store", { selected: _ctx.merchantId === g.id }])
                  },
                  [
                    _createElementVNode("button", {
                      class: "cart-store-head",
                      disabled: _ctx.busy || _ctx.loading,
                      "aria-pressed": _ctx.merchantId === g.id,
                      onClick: ($event) => _ctx.merchantId = g.id
                    }, [
                      _createElementVNode(
                        "span",
                        {
                          class: _normalizeClass(["radio-circle", { active: _ctx.merchantId === g.id }])
                        },
                        [
                          _createVNode2(_component_Icon, {
                            name: "check",
                            size: 12
                          })
                        ],
                        2
                        /* CLASS */
                      ),
                      _createVNode2(_component_Icon, { name: "store" }),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.merchantName(g.id)),
                        1
                        /* TEXT */
                      ),
                      _createElementVNode(
                        "span",
                        { class: "cart-store-total" },
                        _toDisplayString(_ctx.money(g.total)),
                        1
                        /* TEXT */
                      )
                    ], 8, ["disabled", "aria-pressed", "onClick"]),
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(g.rows, (i) => {
                        return _openBlock(), _createElementBlock("div", {
                          class: "cart-line",
                          key: i.skuId
                        }, [
                          _createVNode2(_component_ProductImage, {
                            src: i.imageUrl,
                            alt: i.title
                          }, null, 8, ["src", "alt"]),
                          _createElementVNode("div", { class: "cart-line-info" }, [
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(i.title),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode("button", {
                              disabled: _ctx.busy || _ctx.preview,
                              "aria-label": "移除" + i.title,
                              onClick: ($event) => _ctx.remove(i)
                            }, "移除", 8, ["disabled", "aria-label", "onClick"]),
                            _createElementVNode("small", null, [
                              _createTextVNode(
                                _toDisplayString(i.specKey) + " ",
                                1
                                /* TEXT */
                              ),
                              !i.sellable || i.available < i.quantity ? (_openBlock(), _createElementBlock("span", {
                                key: 0,
                                class: "red-text"
                              }, "库存不足/失效")) : _createCommentVNode("v-if", true)
                            ]),
                            _createElementVNode("div", { class: "cart-line-bottom" }, [
                              _createElementVNode(
                                "b",
                                null,
                                _toDisplayString(_ctx.money(i.priceCent)),
                                1
                                /* TEXT */
                              ),
                              _createElementVNode("div", { class: "mini-qty" }, [
                                _createElementVNode("button", {
                                  disabled: _ctx.busy || _ctx.preview,
                                  "aria-label": "减少" + i.title,
                                  onClick: ($event) => _ctx.quantity(i, -1)
                                }, [
                                  _createVNode2(_component_Icon, {
                                    name: "minus",
                                    size: 15
                                  })
                                ], 8, ["disabled", "aria-label", "onClick"]),
                                _createElementVNode(
                                  "span",
                                  null,
                                  _toDisplayString(i.quantity),
                                  1
                                  /* TEXT */
                                ),
                                _createElementVNode("button", {
                                  disabled: _ctx.busy || _ctx.preview || !i.sellable || i.quantity >= 99 || i.quantity >= i.available,
                                  "aria-label": "增加" + i.title,
                                  onClick: ($event) => _ctx.quantity(i, 1)
                                }, [
                                  _createVNode2(_component_Icon, {
                                    name: "plus",
                                    size: 15
                                  })
                                ], 8, ["disabled", "aria-label", "onClick"])
                              ])
                            ])
                          ])
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ],
                  2
                  /* CLASS */
                );
              }),
              128
              /* KEYED_FRAGMENT */
            )),
            _ctx.groups.length > 1 ? (_openBlock(), _createElementBlock("div", {
              key: 3,
              class: "mobile-hint"
            }, "一次结算一家商户，请选择要下单的店铺。")) : _createCommentVNode("v-if", true),
            _ctx.items.length ? (_openBlock(), _createElementBlock("div", {
              key: 4,
              class: "mobile-summary"
            }, [
              _createElementVNode("div", null, [
                _createTextVNode("商品金额 "),
                _createElementVNode(
                  "strong",
                  null,
                  _toDisplayString(_ctx.money(_ctx.total)),
                  1
                  /* TEXT */
                )
              ]),
              _createElementVNode("div", null, [
                _createTextVNode("自提方式 "),
                _createElementVNode("strong", null, "校内门店自提")
              ]),
              _createElementVNode("div", { class: "mobile-summary-total" }, [
                _createTextVNode("应付 "),
                _createElementVNode(
                  "b",
                  null,
                  _toDisplayString(_ctx.money(_ctx.total)),
                  1
                  /* TEXT */
                )
              ])
            ])) : _createCommentVNode("v-if", true),
            _ctx.items.length ? (_openBlock(), _createElementBlock("div", {
              key: 5,
              class: "mobile-checkout-bar"
            }, [
              _createElementVNode("div", null, [
                _createElementVNode("small", null, "本单合计"),
                _createElementVNode(
                  "b",
                  null,
                  _toDisplayString(_ctx.money(_ctx.total)),
                  1
                  /* TEXT */
                )
              ]),
              _createElementVNode("button", {
                class: "teal-button",
                disabled: _ctx.preview || _ctx.busy || _ctx.loading || !_ctx.selected.length,
                onClick: _ctx.checkout
              }, _toDisplayString(_ctx.busy ? "提交中" : "提交订单"), 9, ["disabled", "onClick"])
            ])) : _createCommentVNode("v-if", true),
            _ctx.confirmOpen ? _withDirectives((_openBlock(), _createElementBlock("div", {
              key: 6,
              class: "ui-overlay",
              onClick: _withModifiers(_ctx.closeConfirm, ["self"])
            }, [
              _createElementVNode("section", {
                class: "product-sheet checkout-confirm",
                role: "dialog",
                "aria-modal": "true",
                "aria-label": "确认订单"
              }, [
                _createElementVNode("button", {
                  class: "sheet-close",
                  onClick: _ctx.closeConfirm,
                  "aria-label": "关闭"
                }, [
                  _createVNode2(_component_Icon, {
                    name: "x",
                    size: 19
                  })
                ], 8, ["onClick"]),
                _createElementVNode("h3", null, "确认订单"),
                _createElementVNode("p", { class: "checkout-note" }, "模拟支付：提交后生成待付款订单，不会发生真实扣款。"),
                _ctx.confirmLoading ? (_openBlock(), _createBlock(_component_StatusPanel, {
                  key: 0,
                  state: "loading",
                  message: "正在核对最新购物车与门店信息…"
                })) : _ctx.confirmError && !_ctx.confirmItems.length ? (_openBlock(), _createElementBlock(
                  _Fragment,
                  { key: 1 },
                  [
                    _createVNode2(_component_StatusPanel, {
                      state: "error",
                      message: _ctx.confirmError,
                      "action-label": "重新加载",
                      busy: _ctx.confirmLoading,
                      onRetry: _ctx.loadConfirmation
                    }, null, 8, ["message", "busy", "onRetry"]),
                    _createElementVNode("button", {
                      class: "outline-button checkout-back",
                      onClick: _ctx.closeConfirm
                    }, "返回调整", 8, ["onClick"])
                  ],
                  64
                  /* STABLE_FRAGMENT */
                )) : (_openBlock(), _createElementBlock(
                  _Fragment,
                  { key: 2 },
                  [
                    _createElementVNode("section", { class: "checkout-shop" }, [
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.confirmMerchant.name || "校内商户"),
                        1
                        /* TEXT */
                      ),
                      _createElementVNode(
                        "span",
                        null,
                        _toDisplayString(_ctx.confirmMerchant.storeName || "门店") + " · " + _toDisplayString(_ctx.confirmMerchant.location || "地点未填写"),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createElementVNode("div", { class: "checkout-lines" }, [
                      (_openBlock(true), _createElementBlock(
                        _Fragment,
                        null,
                        _renderList(_ctx.confirmItems, (i) => {
                          return _openBlock(), _createElementBlock("div", {
                            key: i.skuId,
                            class: "checkout-line"
                          }, [
                            _createElementVNode("div", null, [
                              _createElementVNode(
                                "strong",
                                null,
                                _toDisplayString(i.title),
                                1
                                /* TEXT */
                              ),
                              _createElementVNode(
                                "small",
                                null,
                                _toDisplayString(i.specKey) + " × " + _toDisplayString(i.quantity) + " · " + _toDisplayString(_ctx.money(i.priceCent)) + "/件",
                                1
                                /* TEXT */
                              )
                            ]),
                            _createElementVNode(
                              "b",
                              null,
                              _toDisplayString(_ctx.money(Number(i.priceCent) * Number(i.quantity))),
                              1
                              /* TEXT */
                            )
                          ]);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      ))
                    ]),
                    _createElementVNode("div", { class: "checkout-total" }, [
                      _createElementVNode("span", null, "应付合计"),
                      _createElementVNode(
                        "b",
                        null,
                        _toDisplayString(_ctx.money(_ctx.confirmTotal)),
                        1
                        /* TEXT */
                      )
                    ]),
                    _ctx.confirmRetryable ? (_openBlock(), _createElementBlock("div", {
                      key: 0,
                      class: "mobile-hint",
                      role: "status"
                    }, "提交结果未知，可直接重试；同一内容不会重复下单。")) : _createCommentVNode("v-if", true),
                    _ctx.confirmError ? (_openBlock(), _createElementBlock("div", {
                      key: 1,
                      class: "inline-error",
                      role: "alert"
                    }, [
                      _createTextVNode(
                        _toDisplayString(_ctx.confirmError) + " ",
                        1
                        /* TEXT */
                      ),
                      _createElementVNode("button", { onClick: _ctx.loadConfirmation }, "刷新确认信息", 8, ["onClick"])
                    ])) : _createCommentVNode("v-if", true),
                    _createElementVNode("div", { class: "checkout-actions" }, [
                      _createElementVNode("button", {
                        class: "outline-button",
                        onClick: _ctx.closeConfirm,
                        disabled: _ctx.busy
                      }, "返回调整", 8, ["onClick", "disabled"]),
                      _createElementVNode("button", {
                        class: "teal-button",
                        disabled: _ctx.busy || _ctx.confirmLoading || !!_ctx.confirmError,
                        onClick: _ctx.confirmCheckout
                      }, _toDisplayString(_ctx.busy ? "提交中…" : "确认下单（模拟支付）"), 9, ["disabled", "onClick"])
                    ])
                  ],
                  64
                  /* STABLE_FRAGMENT */
                ))
              ])
            ], 8, ["onClick"])), [
              [_directive_modal, _ctx.closeConfirm]
            ]) : _createCommentVNode("v-if", true)
          ]),
          _: 1
          /* STABLE */
        });
      };
    })()
  };
  const { ref: ref$7, computed: computed$7, onMounted: onMounted$6, watch: watch$6 } = Vue;
  const Orders = {
    name: "Orders",
    components: { ConsumerShell, ProductImage, StatusPanel: _sfc_main },
    setup() {
      const scope = requestScope();
      const orders = ref$7([]), detail = ref$7(null), token = ref$7(null), error = ref$7(""), busy = ref$7(false), loading = ref$7(true), tab = ref$7("ALL"), page = ref$7(1), pageInfo = ref$7({ total: 0, hasNext: false }), refundOpen = ref$7(false), reason = ref$7("");
      const id = computed$7(
        () => store.route.startsWith("/orders/") ? safeDecodeId(store.route.slice("/orders/".length)) : null
      );
      const filtered = computed$7(
        () => orders.value.filter((o) => tab.value === "ALL" || o.status === tab.value)
      );
      const refundPending = computed$7(
        () => {
          var _a;
          return !!((_a = detail.value) == null ? void 0 : _a.afterSale) && ["REQUESTED", "DISPUTED", "APPROVED"].includes(detail.value.afterSale.status);
        }
      );
      const merchantName = (id2, record) => {
        var _a;
        return (record == null ? void 0 : record.merchantName) || ((_a = store.merchants.find((m) => m.merchantId === id2)) == null ? void 0 : _a.name) || "校内商户";
      };
      async function load() {
        const request2 = scope.begin();
        const target = id.value;
        loading.value = true;
        error.value = "";
        token.value = null;
        refundOpen.value = false;
        if (preview) {
          orders.value = DEMO_ORDERS.map((x) => ({ ...x }));
          pageInfo.value = { total: orders.value.length, hasNext: false };
          detail.value = id.value ? orders.value.find((o) => o.orderId === id.value) || null : null;
          loading.value = false;
          return true;
        }
        try {
          if (store.route.startsWith("/orders/") && !target) throw Error("无效订单地址");
          if (id.value) {
            const result = await api("/orders/" + pathId(target), { signal: request2.signal });
            if (!request2.current()) return false;
            detail.value = result;
          } else {
            detail.value = null;
            const result = await api(
              "/orders/page" + query({ page: page.value, size: 10, state: tab.value === "ALL" ? "" : tab.value }),
              { signal: request2.signal }
            );
            if (!request2.current()) return false;
            orders.value = result.items || [];
            pageInfo.value = result;
          }
          return true;
        } catch (e) {
          if (request2.current()) error.value = e.message;
          return false;
        } finally {
          if (request2.current()) loading.value = false;
        }
      }
      onMounted$6(load);
      watch$6([page, tab], () => {
        if (!id.value) load();
      });
      async function action(endpoint, method = "POST", body) {
        var _a, _b;
        if (preview || busy.value || loading.value || !!error.value || !detail.value)
          return { ok: false };
        const current = scope.capture(), orderId = detail.value.orderId;
        busy.value = true;
        try {
          const result = await api("/orders/" + pathId(orderId) + endpoint, {
            method,
            body
          });
          if (!current() || ((_a = detail.value) == null ? void 0 : _a.orderId) !== orderId) return { ok: false };
          if (endpoint === "/pickup-token") {
            token.value = result;
            return { ok: true, refreshed: true };
          }
          notify("操作成功");
          const refreshed = await load();
          if (!current() || ((_b = detail.value) == null ? void 0 : _b.orderId) !== orderId) return { ok: true, refreshed: false };
          if (!refreshed) notify("操作成功，但页面刷新失败，请稍后手动刷新");
          return { ok: true, refreshed };
        } catch (e) {
          if (current()) notify(e.message);
          return { ok: false };
        } finally {
          if (current()) busy.value = false;
        }
      }
      async function submitRefund() {
        var _a, _b;
        if (!reason.value.trim()) {
          notify("请输入退款原因");
          return;
        }
        const current = scope.capture(), orderId = (_a = detail.value) == null ? void 0 : _a.orderId;
        const result = await action("/refunds", "POST", { reason: reason.value.trim() });
        if (!result.ok || !current() || ((_b = detail.value) == null ? void 0 : _b.orderId) !== orderId) return;
        refundOpen.value = false;
        reason.value = "";
      }
      function statusClass(s) {
        return ["PAID", "COMPLETED"].includes(s) ? "ok" : ["CANCELED", "REFUNDED"].includes(s) ? "muted" : "warn";
      }
      const allowToken = computed$7(
        () => {
          var _a, _b, _c, _d, _e;
          return ((_a = detail.value) == null ? void 0 : _a.status) === "PAID" && ((_c = (_b = detail.value) == null ? void 0 : _b.pickup) == null ? void 0 : _c.status) === "READY" && !["REQUESTED", "DISPUTED", "APPROVED"].includes((_e = (_d = detail.value) == null ? void 0 : _d.afterSale) == null ? void 0 : _e.status);
        }
      );
      return {
        store,
        orders,
        loading,
        pathId,
        detail,
        filtered,
        token,
        error,
        busy,
        tab,
        page,
        pageInfo,
        refundOpen,
        reason,
        id,
        preview,
        go,
        money,
        afterSaleStatusLabel,
        orderStatusLabel,
        dateTime,
        merchantName,
        action,
        submitRefund,
        statusClass,
        allowToken,
        refundPending,
        eventLabel: orderEventLabel,
        load
      };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode2, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, openBlock: _openBlock, createBlock: _createBlock, createCommentVNode: _createCommentVNode, renderList: _renderList, Fragment: _Fragment, createElementBlock: _createElementBlock, normalizeClass: _normalizeClass, createTextVNode: _createTextVNode, vModelText: _vModelText, withDirectives: _withDirectives, withModifiers: _withModifiers, withCtx: _withCtx } = Vue;
      return function render2(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_StatusPanel = _resolveComponent("StatusPanel");
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_ConsumerShell = _resolveComponent("ConsumerShell");
        return _openBlock(), _createBlock(_component_ConsumerShell, { active: "orders" }, {
          default: _withCtx(() => {
            var _a, _b, _c, _d, _e, _f;
            return [
              _createElementVNode("div", { class: "mobile-page-top" }, [
                _createElementVNode("button", {
                  onClick: ($event) => _ctx.go(_ctx.id ? "/orders" : "/"),
                  "aria-label": "返回"
                }, [
                  _createVNode2(_component_Icon, { name: "arrowLeft" })
                ], 8, ["onClick"]),
                _createElementVNode(
                  "b",
                  null,
                  _toDisplayString(_ctx.id ? "订单详情" : "我的订单"),
                  1
                  /* TEXT */
                ),
                _createElementVNode("button", {
                  disabled: _ctx.busy || _ctx.loading,
                  onClick: _ctx.load,
                  "aria-label": "刷新"
                }, [
                  _createVNode2(_component_Icon, { name: "refresh" })
                ], 8, ["disabled", "onClick"])
              ]),
              _ctx.loading ? (_openBlock(), _createBlock(_component_StatusPanel, {
                key: 0,
                state: "loading",
                message: "正在加载订单…"
              })) : _ctx.error ? (_openBlock(), _createBlock(_component_StatusPanel, {
                key: 1,
                state: "error",
                message: _ctx.error,
                "action-label": "重新加载",
                busy: _ctx.loading,
                onRetry: _ctx.load
              }, null, 8, ["message", "busy", "onRetry"])) : !_ctx.id ? (_openBlock(), _createElementBlock(
                _Fragment,
                { key: 2 },
                [
                  _createElementVNode("div", { class: "order-tabs" }, [
                    (_openBlock(), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList([["ALL", "全部"], ["PENDING_PAYMENT", "待付款"], ["PAID", "待自提"], ["COMPLETED", "已完成"]], (t2) => {
                        return _createElementVNode("button", {
                          class: _normalizeClass({ active: _ctx.tab === t2[0] }),
                          key: t2[0],
                          onClick: ($event) => {
                            _ctx.page = 1;
                            _ctx.tab = t2[0];
                          }
                        }, _toDisplayString(t2[1]), 11, ["onClick"]);
                      }),
                      64
                      /* STABLE_FRAGMENT */
                    ))
                  ]),
                  !_ctx.filtered.length ? (_openBlock(), _createBlock(_component_StatusPanel, {
                    key: 0,
                    state: "empty",
                    message: "暂无订单"
                  })) : _createCommentVNode("v-if", true),
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(_ctx.filtered, (o) => {
                      var _a2, _b2, _c2, _d2, _e2, _f2, _g;
                      return _openBlock(), _createElementBlock("button", {
                        class: "consumer-order-card",
                        key: o.orderId,
                        onClick: ($event) => _ctx.go("/orders/" + _ctx.pathId(o.orderId))
                      }, [
                        _createElementVNode("div", { class: "order-card-head" }, [
                          _createElementVNode("span", null, [
                            _createVNode2(_component_Icon, {
                              name: "store",
                              size: 17
                            }),
                            _createTextVNode(
                              _toDisplayString(_ctx.merchantName(o.merchantId, o)),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode(
                            "b",
                            {
                              class: _normalizeClass(_ctx.statusClass(o.status))
                            },
                            _toDisplayString(_ctx.orderStatusLabel(o.status)),
                            3
                            /* TEXT, CLASS */
                          )
                        ]),
                        _createElementVNode("div", { class: "order-goods" }, [
                          _createElementVNode("div", { class: "order-item-placeholder" }, [
                            _createVNode2(_component_ProductImage, {
                              src: (_b2 = (_a2 = o.items) == null ? void 0 : _a2[0]) == null ? void 0 : _b2.imageUrl,
                              alt: ((_d2 = (_c2 = o.items) == null ? void 0 : _c2[0]) == null ? void 0 : _d2.title) || "商品"
                            }, null, 8, ["src", "alt"])
                          ]),
                          _createElementVNode("div", null, [
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(((_f2 = (_e2 = o.items) == null ? void 0 : _e2[0]) == null ? void 0 : _f2.title) || "校园订单"),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode(
                              "small",
                              null,
                              _toDisplayString(((_g = o.items) == null ? void 0 : _g.length) || 0) + " 种商品 · " + _toDisplayString(_ctx.dateTime(o.createdAt)),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode(
                            "b",
                            null,
                            _toDisplayString(_ctx.money(o.totalCent)),
                            1
                            /* TEXT */
                          )
                        ]),
                        _createElementVNode("div", { class: "order-card-foot" }, [
                          _createTextVNode(
                            "#" + _toDisplayString(o.orderId) + " ",
                            1
                            /* TEXT */
                          ),
                          _createElementVNode("span", null, [
                            _createTextVNode("查看详情 "),
                            _createVNode2(_component_Icon, {
                              name: "chevronRight",
                              size: 14
                            })
                          ])
                        ])
                      ], 8, ["onClick"]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  !_ctx.preview && _ctx.pageInfo.total > 0 ? (_openBlock(), _createElementBlock("div", {
                    key: 1,
                    class: "sdd-pager"
                  }, [
                    _createElementVNode(
                      "span",
                      null,
                      "共 " + _toDisplayString(_ctx.pageInfo.total) + " 单",
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("button", {
                      disabled: _ctx.page <= 1,
                      onClick: ($event) => _ctx.page--
                    }, "上一页", 8, ["disabled", "onClick"]),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.page),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("button", {
                      disabled: !_ctx.pageInfo.hasNext,
                      onClick: ($event) => _ctx.page++
                    }, "下一页", 8, ["disabled", "onClick"])
                  ])) : _createCommentVNode("v-if", true)
                ],
                64
                /* STABLE_FRAGMENT */
              )) : _ctx.detail ? (_openBlock(), _createElementBlock(
                _Fragment,
                { key: 3 },
                [
                  _createElementVNode(
                    "section",
                    {
                      class: _normalizeClass(["pickup-hero", { complete: _ctx.detail.status === "COMPLETED" }])
                    },
                    [
                      _createElementVNode("div", { class: "pickup-status-icon" }, [
                        _createVNode2(_component_Icon, {
                          name: _ctx.detail.status === "COMPLETED" ? "check" : "clock",
                          size: 28
                        }, null, 8, ["name"])
                      ]),
                      _createElementVNode("div", null, [
                        _createElementVNode(
                          "h1",
                          null,
                          _toDisplayString(((_a = _ctx.detail.pickup) == null ? void 0 : _a.status) === "READY" ? "待自提" : _ctx.orderStatusLabel(_ctx.detail.status)),
                          1
                          /* TEXT */
                        ),
                        _createElementVNode(
                          "p",
                          null,
                          _toDisplayString(_ctx.detail.status === "COMPLETED" ? "感谢购买" : _ctx.detail.status === "PAID" ? "校内门店自提" : _ctx.detail.status === "PENDING_PAYMENT" ? "请在付款截止前完成模拟支付" : "查看订单记录"),
                          1
                          /* TEXT */
                        )
                      ])
                    ],
                    2
                    /* CLASS */
                  ),
                  _createElementVNode("section", { class: "detail-card" }, [
                    _createElementVNode("div", { class: "order-card-head" }, [
                      _createElementVNode("span", null, [
                        _createVNode2(_component_Icon, {
                          name: "store",
                          size: 18
                        }),
                        _createTextVNode(
                          _toDisplayString(_ctx.merchantName(_ctx.detail.merchantId, _ctx.detail)),
                          1
                          /* TEXT */
                        )
                      ]),
                      _createVNode2(_component_Icon, {
                        name: "chevronRight",
                        size: 17
                      })
                    ]),
                    _createElementVNode("div", { class: "pickup-location" }, [
                      _createVNode2(_component_Icon, {
                        name: "pin",
                        size: 19
                      }),
                      _ctx.detail.pickupStoreName || _ctx.detail.pickupLocation ? (_openBlock(), _createElementBlock(
                        "span",
                        { key: 0 },
                        _toDisplayString(_ctx.detail.pickupStoreName || "自提门店") + " · " + _toDisplayString(_ctx.detail.pickupLocation || "地点未记录"),
                        1
                        /* TEXT */
                      )) : (_openBlock(), _createElementBlock("span", { key: 1 }, "历史自提地点未记录"))
                    ]),
                    !_ctx.detail.pickupStoreName && !_ctx.detail.pickupLocation ? (_openBlock(), _createElementBlock(
                      "small",
                      {
                        key: 0,
                        class: "muted-short"
                      },
                      "当前门店：" + _toDisplayString(((_b = _ctx.store.merchants.find((m) => m.merchantId === _ctx.detail.merchantId)) == null ? void 0 : _b.location) || "未提供") + "（仅供参考，非下单时快照）",
                      1
                      /* TEXT */
                    )) : _createCommentVNode("v-if", true)
                  ]),
                  _ctx.detail.status === "PAID" && !_ctx.refundPending ? (_openBlock(), _createElementBlock("section", {
                    key: 0,
                    class: "detail-card token-card"
                  }, [
                    _createElementVNode("h2", null, "自提凭证"),
                    _ctx.token ? (_openBlock(), _createElementBlock("div", {
                      key: 0,
                      class: "pickup-code"
                    }, [
                      _createVNode2(_component_Icon, {
                        name: "shield",
                        size: 25
                      }),
                      _createElementVNode(
                        "code",
                        null,
                        _toDisplayString(_ctx.token.token),
                        1
                        /* TEXT */
                      ),
                      _createElementVNode(
                        "small",
                        null,
                        "有效期至 " + _toDisplayString(_ctx.dateTime(_ctx.token.expiresAt)) + "，再次签发旧凭证失效",
                        1
                        /* TEXT */
                      )
                    ])) : (_openBlock(), _createElementBlock("div", {
                      key: 1,
                      class: "pickup-code placeholder-code"
                    }, [
                      _createVNode2(_component_Icon, {
                        name: "scan",
                        size: 30
                      }),
                      _createElementVNode(
                        "span",
                        null,
                        _toDisplayString(((_c = _ctx.detail.pickup) == null ? void 0 : _c.status) === "READY" ? "可领取自提令牌" : "等待商户备货完成"),
                        1
                        /* TEXT */
                      )
                    ])),
                    _createElementVNode("button", {
                      class: "teal-button",
                      disabled: _ctx.preview || _ctx.busy || _ctx.loading || !!_ctx.error || !_ctx.allowToken,
                      onClick: ($event) => _ctx.action("/pickup-token")
                    }, _toDisplayString(_ctx.token ? "重新签发自提凭证" : "领取自提凭证"), 9, ["disabled", "onClick"])
                  ])) : _createCommentVNode("v-if", true),
                  _ctx.detail.status === "PAID" && _ctx.refundPending ? (_openBlock(), _createElementBlock("section", {
                    key: 1,
                    class: "detail-card token-card"
                  }, [
                    _createElementVNode("h2", null, "退款处理中"),
                    _createElementVNode("p", { class: "muted-short" }, "自提凭证暂停使用，请以退款进度为准。")
                  ])) : _createCommentVNode("v-if", true),
                  _createElementVNode("section", { class: "detail-card" }, [
                    _createElementVNode("h2", { class: "card-title-inline" }, [
                      _createTextVNode("商品清单 "),
                      _createElementVNode(
                        "span",
                        null,
                        _toDisplayString(((_d = _ctx.detail.items) == null ? void 0 : _d.length) || 0) + " 种",
                        1
                        /* TEXT */
                      )
                    ]),
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.detail.items, (i) => {
                        return _openBlock(), _createElementBlock("div", {
                          class: "order-detail-line",
                          key: i.skuId
                        }, [
                          _createElementVNode("div", { class: "order-item-placeholder" }, [
                            _createVNode2(_component_ProductImage, {
                              src: i.imageUrl,
                              alt: i.title
                            }, null, 8, ["src", "alt"])
                          ]),
                          _createElementVNode("div", null, [
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(i.title),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode(
                              "small",
                              null,
                              _toDisplayString(i.specKey) + " × " + _toDisplayString(i.quantity),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode(
                            "b",
                            null,
                            _toDisplayString(_ctx.money(Number(i.unitPriceCent) * Number(i.quantity))),
                            1
                            /* TEXT */
                          )
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    )),
                    _createElementVNode("div", { class: "price-row" }, [
                      _createElementVNode("span", null, "实付 / 应付"),
                      _createElementVNode(
                        "b",
                        null,
                        _toDisplayString(_ctx.money(_ctx.detail.totalCent)),
                        1
                        /* TEXT */
                      )
                    ])
                  ]),
                  _createElementVNode("section", { class: "detail-card order-metadata" }, [
                    _createElementVNode("div", null, [
                      _createElementVNode("span", null, "订单编号"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.detail.orderId),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createElementVNode("div", null, [
                      _createElementVNode("span", null, "下单时间"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.dateTime(_ctx.detail.createdAt)),
                        1
                        /* TEXT */
                      )
                    ]),
                    _ctx.detail.status === "PENDING_PAYMENT" ? (_openBlock(), _createElementBlock("div", { key: 0 }, [
                      _createElementVNode("span", null, "付款截止"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.dateTime(_ctx.detail.deadline)),
                        1
                        /* TEXT */
                      )
                    ])) : _createCommentVNode("v-if", true),
                    _ctx.detail.afterSale ? (_openBlock(), _createElementBlock("div", { key: 1 }, [
                      _createElementVNode("span", null, "售后状态"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.afterSaleStatusLabel(_ctx.detail.afterSale.status)),
                        1
                        /* TEXT */
                      )
                    ])) : _createCommentVNode("v-if", true)
                  ]),
                  _createElementVNode("section", { class: "detail-card order-timeline" }, [
                    _createElementVNode("h2", { class: "card-title-inline" }, "订单进度"),
                    ((_e = _ctx.detail.events) == null ? void 0 : _e.length) ? (_openBlock(), _createElementBlock("ol", { key: 0 }, [
                      (_openBlock(true), _createElementBlock(
                        _Fragment,
                        null,
                        _renderList(_ctx.detail.events, (e, i) => {
                          return _openBlock(), _createElementBlock("li", {
                            key: e.eventId || i
                          }, [
                            _createElementVNode("span", { class: "timeline-dot" }),
                            _createElementVNode("div", null, [
                              _createElementVNode(
                                "strong",
                                null,
                                _toDisplayString(_ctx.eventLabel(e.type)),
                                1
                                /* TEXT */
                              ),
                              _createElementVNode("small", null, [
                                _createTextVNode(
                                  _toDisplayString(_ctx.dateTime(e.occurredAt)),
                                  1
                                  /* TEXT */
                                ),
                                e.reason ? (_openBlock(), _createElementBlock(
                                  _Fragment,
                                  { key: 0 },
                                  [
                                    _createTextVNode(
                                      " · " + _toDisplayString(e.reason),
                                      1
                                      /* TEXT */
                                    )
                                  ],
                                  64
                                  /* STABLE_FRAGMENT */
                                )) : _createCommentVNode("v-if", true)
                              ])
                            ])
                          ]);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      ))
                    ])) : (_openBlock(), _createElementBlock("p", {
                      key: 1,
                      class: "muted-short"
                    }, "历史进度未记录"))
                  ]),
                  !_ctx.preview ? (_openBlock(), _createElementBlock("section", {
                    key: 2,
                    class: "order-actions"
                  }, [
                    _ctx.detail.status === "PENDING_PAYMENT" ? (_openBlock(), _createElementBlock("button", {
                      key: 0,
                      class: "teal-button",
                      disabled: _ctx.busy || _ctx.loading || !!_ctx.error,
                      onClick: ($event) => _ctx.action("/pay")
                    }, "模拟支付", 8, ["disabled", "onClick"])) : _createCommentVNode("v-if", true),
                    _ctx.detail.status === "PENDING_PAYMENT" ? (_openBlock(), _createElementBlock("button", {
                      key: 1,
                      class: "outline-button",
                      disabled: _ctx.busy || _ctx.loading || !!_ctx.error,
                      onClick: ($event) => _ctx.action("/cancel")
                    }, "取消订单", 8, ["disabled", "onClick"])) : _createCommentVNode("v-if", true),
                    _ctx.detail.status === "PAID" && !_ctx.detail.afterSale ? (_openBlock(), _createElementBlock("button", {
                      key: 2,
                      class: "outline-button",
                      disabled: _ctx.busy || _ctx.loading || !!_ctx.error,
                      onClick: ($event) => _ctx.refundOpen = !_ctx.refundOpen
                    }, "申请退款", 8, ["disabled", "onClick"])) : _createCommentVNode("v-if", true),
                    _ctx.detail.status === "PAID" && ((_f = _ctx.detail.afterSale) == null ? void 0 : _f.status) === "REJECTED" ? (_openBlock(), _createElementBlock("button", {
                      key: 3,
                      class: "outline-button",
                      disabled: _ctx.busy || _ctx.loading || !!_ctx.error,
                      onClick: ($event) => _ctx.action("/appeal")
                    }, "申请平台介入", 8, ["disabled", "onClick"])) : _createCommentVNode("v-if", true)
                  ])) : _createCommentVNode("v-if", true),
                  _ctx.refundOpen && !_ctx.preview ? (_openBlock(), _createElementBlock("form", {
                    key: 3,
                    class: "detail-card",
                    onSubmit: _withModifiers(_ctx.submitRefund, ["prevent"])
                  }, [
                    _createElementVNode("label", {
                      class: "field-label",
                      for: "orders-field-1"
                    }, "退款原因"),
                    _withDirectives(_createElementVNode("textarea", {
                      id: "orders-field-1",
                      class: "admin-input",
                      "onUpdate:modelValue": ($event) => _ctx.reason = $event,
                      maxlength: "500",
                      rows: "3",
                      required: ""
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.reason]
                    ]),
                    _createElementVNode("button", {
                      type: "submit",
                      class: "teal-button",
                      disabled: _ctx.busy || _ctx.loading || !!_ctx.error
                    }, "提交退款申请", 8, ["disabled"])
                  ], 40, ["onSubmit"])) : _createCommentVNode("v-if", true)
                ],
                64
                /* STABLE_FRAGMENT */
              )) : (_openBlock(), _createBlock(_component_StatusPanel, {
                key: 4,
                state: "empty",
                message: "未找到订单"
              }))
            ];
          }),
          _: 1
          /* STABLE */
        });
      };
    })()
  };
  const { ref: ref$6, computed: computed$6, onMounted: onMounted$5, onUnmounted: onUnmounted$5, watch: watch$5 } = Vue;
  const Account = {
    name: "Account",
    components: { ConsumerShell, AuthDialog },
    setup() {
      const scope = requestScope();
      const page = ref$6(1), pageInfo = ref$6({ total: 0, hasNext: false });
      const login = ref$6(false), apps = ref$6([]), invitations = ref$6([]), invitePage = ref$6(1), error = ref$6(""), busy = ref$6(false), loading = ref$6(false), key = ref$6(""), fingerprint = ref$6("");
      let loadEpoch = 0;
      const form = ref$6({
        merchantName: "",
        category: "便利零售",
        contactName: "",
        contactPhone: "",
        storeName: "",
        location: ""
      });
      const isApply = computed$6(() => store.route === "/apply");
      const isInvite = computed$6(() => store.route === "/invitations");
      async function load() {
        var _a, _b;
        const stamp = ++loadEpoch;
        error.value = "";
        if (preview) {
          apps.value = DEMO_APPLICATIONS;
          invitations.value = [
            {
              id: "INV-01",
              merchantId: "preview-m1",
              status: "PENDING",
              expiresAt: "2026-10-30T12:00:00Z"
            }
          ];
          return;
        }
        loading.value = true;
        try {
          if (stamp !== loadEpoch) return;
          const actor = (_a = store.user) == null ? void 0 : _a.userId;
          if (!store.user) {
            apps.value = [];
            invitations.value = [];
            return;
          }
          const [a, i] = await Promise.all([
            !isApply.value && !isInvite.value ? api("/merchant-applications/mine/page" + query({ page: page.value, size: 10 })) : Promise.resolve({ items: [], total: 0 }),
            !isApply.value ? api("/invitations" + query({ page: invitePage.value, size: 20 })) : Promise.resolve([])
          ]);
          if (stamp !== loadEpoch || actor !== ((_b = store.user) == null ? void 0 : _b.userId)) return;
          apps.value = a.items || [];
          pageInfo.value = a;
          invitations.value = i || [];
        } catch (e) {
          if (stamp === loadEpoch) error.value = e.message;
        } finally {
          if (stamp === loadEpoch) loading.value = false;
        }
      }
      onMounted$5(load);
      watch$5(page, load);
      watch$5(invitePage, load);
      onUnmounted$5(() => ++loadEpoch);
      async function submit() {
        if (preview || busy.value) return;
        const f = { ...form.value }, current = scope.capture();
        if (!Object.values(f).every((x) => String(x).trim())) {
          notify("请补全申请资料");
          return;
        }
        const next = JSON.stringify(f);
        if (!key.value || fingerprint.value !== next) {
          key.value = idempotency();
          fingerprint.value = next;
        }
        busy.value = true;
        try {
          await api("/merchant-applications", { method: "POST", body: { ...f }, key: key.value });
          if (!current()) return;
          key.value = "";
          fingerprint.value = "";
          notify("申请已提交");
          await load();
          if (current()) go("/account");
        } catch (e) {
          if (current()) notify(e.message);
        } finally {
          if (current()) busy.value = false;
        }
      }
      async function accept(i) {
        if (preview || busy.value) return;
        if (i.status !== "PENDING" || invitationIsExpired(i)) {
          notify("邀请已过期或不可接受");
          return;
        }
        const current = scope.capture();
        busy.value = true;
        try {
          await api("/invitations/" + encodeURIComponent(i.id) + "/accept", { method: "POST" });
          if (!current()) return;
          notify("邀请已接受");
          await load();
        } catch (e) {
          if (current()) notify(e.message);
        } finally {
          if (current()) busy.value = false;
        }
      }
      return {
        store,
        go,
        preview,
        login,
        apps,
        page,
        pageInfo,
        invitations,
        invitePage,
        error,
        busy,
        loading,
        form,
        isApply,
        isInvite,
        submit,
        accept,
        applicationStatusLabel,
        invitationIsExpired,
        invitationStatusLabel,
        load
      };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode2, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, createTextVNode: _createTextVNode, renderList: _renderList, Fragment: _Fragment, normalizeClass: _normalizeClass, vModelText: _vModelText, withDirectives: _withDirectives, vModelSelect: _vModelSelect, withModifiers: _withModifiers, createBlock: _createBlock, withCtx: _withCtx } = Vue;
      return function render2(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_AuthDialog = _resolveComponent("AuthDialog");
        const _component_ConsumerShell = _resolveComponent("ConsumerShell");
        return _openBlock(), _createBlock(_component_ConsumerShell, { active: "account" }, {
          default: _withCtx(() => {
            var _a, _b;
            return [
              _createElementVNode("div", { class: "mobile-page-top" }, [
                _createElementVNode("button", {
                  onClick: ($event) => _ctx.go("/account"),
                  "aria-label": "返回"
                }, [
                  _createVNode2(_component_Icon, { name: "arrowLeft" })
                ], 8, ["onClick"]),
                _createElementVNode(
                  "b",
                  null,
                  _toDisplayString(_ctx.isApply ? "商户入驻" : _ctx.isInvite ? "收到的邀请" : "个人中心"),
                  1
                  /* TEXT */
                ),
                !_ctx.isApply && !_ctx.isInvite ? (_openBlock(), _createElementBlock("button", {
                  key: 0,
                  onClick: _ctx.load,
                  "aria-label": "刷新"
                }, [
                  _createVNode2(_component_Icon, { name: "refresh" })
                ], 8, ["onClick"])) : _createCommentVNode("v-if", true)
              ]),
              !_ctx.isApply && !_ctx.isInvite ? (_openBlock(), _createElementBlock(
                _Fragment,
                { key: 0 },
                [
                  _createElementVNode("section", { class: "account-profile" }, [
                    _createElementVNode("div", { class: "profile-avatar" }, [
                      _createVNode2(_component_Icon, {
                        name: "user",
                        size: 30
                      })
                    ]),
                    _createElementVNode("div", null, [
                      _createElementVNode(
                        "h1",
                        null,
                        _toDisplayString(((_a = _ctx.store.user) == null ? void 0 : _a.displayName) || "校园同学"),
                        1
                        /* TEXT */
                      ),
                      _createElementVNode(
                        "p",
                        null,
                        _toDisplayString(((_b = _ctx.store.user) == null ? void 0 : _b.username) || "登录后查看订单与申请"),
                        1
                        /* TEXT */
                      )
                    ]),
                    !_ctx.store.user && !_ctx.preview ? (_openBlock(), _createElementBlock("button", {
                      key: 0,
                      class: "outline-button",
                      onClick: ($event) => _ctx.login = true
                    }, "登录 / 注册", 8, ["onClick"])) : _createCommentVNode("v-if", true),
                    _ctx.preview ? (_openBlock(), _createElementBlock("span", {
                      key: 1,
                      class: "demo-pill"
                    }, "设计预览")) : _createCommentVNode("v-if", true)
                  ]),
                  _createElementVNode("div", { class: "account-quick" }, [
                    _createElementVNode("button", {
                      onClick: ($event) => _ctx.go("/orders")
                    }, [
                      _createVNode2(_component_Icon, { name: "order" }),
                      _createElementVNode("span", null, "我的订单")
                    ], 8, ["onClick"]),
                    _createElementVNode("button", {
                      onClick: ($event) => _ctx.go("/cart")
                    }, [
                      _createVNode2(_component_Icon, { name: "cart" }),
                      _createElementVNode("span", null, "购物车")
                    ], 8, ["onClick"]),
                    _createElementVNode("button", {
                      onClick: ($event) => _ctx.go("/apply")
                    }, [
                      _createVNode2(_component_Icon, { name: "store" }),
                      _createElementVNode("span", null, "商户入驻")
                    ], 8, ["onClick"]),
                    _createElementVNode("button", {
                      onClick: ($event) => _ctx.go("/invitations")
                    }, [
                      _createVNode2(_component_Icon, { name: "users" }),
                      _createElementVNode("span", null, "邀请")
                    ], 8, ["onClick"])
                  ]),
                  _createElementVNode("div", { class: "account-section-head" }, [
                    _createElementVNode("h2", null, "入驻记录"),
                    _createElementVNode("button", {
                      onClick: ($event) => _ctx.go("/apply")
                    }, [
                      _createTextVNode("去申请 "),
                      _createVNode2(_component_Icon, {
                        name: "chevronRight",
                        size: 15
                      })
                    ], 8, ["onClick"])
                  ]),
                  _ctx.error ? (_openBlock(), _createElementBlock(
                    "div",
                    {
                      key: 0,
                      class: "inline-error"
                    },
                    _toDisplayString(_ctx.error),
                    1
                    /* TEXT */
                  )) : _createCommentVNode("v-if", true),
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(_ctx.apps, (a) => {
                      return _openBlock(), _createElementBlock("div", {
                        class: "account-application",
                        key: a.applicationId
                      }, [
                        _createElementVNode("div", null, [
                          _createElementVNode(
                            "strong",
                            null,
                            _toDisplayString(a.merchantName),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "span",
                            null,
                            _toDisplayString(a.storeName) + " · " + _toDisplayString(a.location),
                            1
                            /* TEXT */
                          )
                        ]),
                        _createElementVNode(
                          "b",
                          {
                            class: _normalizeClass(["status-tag", a.status === "APPROVED" ? "published" : "draft"])
                          },
                          _toDisplayString(_ctx.applicationStatusLabel(a.status)),
                          3
                          /* TEXT, CLASS */
                        ),
                        a.rejectionReason ? (_openBlock(), _createElementBlock(
                          "p",
                          { key: 0 },
                          _toDisplayString(a.rejectionReason),
                          1
                          /* TEXT */
                        )) : _createCommentVNode("v-if", true)
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  !_ctx.loading && !_ctx.apps.length && !_ctx.error ? (_openBlock(), _createElementBlock("div", {
                    key: 1,
                    class: "mobile-empty"
                  }, "暂无入驻记录")) : _createCommentVNode("v-if", true),
                  !_ctx.preview && _ctx.pageInfo.total > 0 ? (_openBlock(), _createElementBlock("div", {
                    key: 2,
                    class: "sdd-pager"
                  }, [
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.pageInfo.total) + " 条",
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("button", {
                      disabled: _ctx.page <= 1,
                      onClick: ($event) => _ctx.page--
                    }, "上一页", 8, ["disabled", "onClick"]),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.page),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("button", {
                      disabled: !_ctx.pageInfo.hasNext,
                      onClick: ($event) => _ctx.page++
                    }, "下一页", 8, ["disabled", "onClick"])
                  ])) : _createCommentVNode("v-if", true)
                ],
                64
                /* STABLE_FRAGMENT */
              )) : _ctx.isApply ? (_openBlock(), _createElementBlock("form", {
                key: 1,
                class: "account-form detail-card",
                onSubmit: _withModifiers(_ctx.submit, ["prevent"])
              }, [
                _createElementVNode("label", null, [
                  _createTextVNode("经营名称"),
                  _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": ($event) => _ctx.form.merchantName = $event,
                    required: "",
                    maxlength: "100",
                    placeholder: "商户名称"
                  }, null, 8, ["onUpdate:modelValue"]), [
                    [
                      _vModelText,
                      _ctx.form.merchantName,
                      void 0,
                      { trim: true }
                    ]
                  ])
                ]),
                _createElementVNode("label", null, [
                  _createTextVNode("经营品类"),
                  _withDirectives(_createElementVNode("select", {
                    "onUpdate:modelValue": ($event) => _ctx.form.category = $event
                  }, [
                    _createElementVNode("option", null, "便利零售"),
                    _createElementVNode("option", null, "水果生鲜"),
                    _createElementVNode("option", null, "文具用品"),
                    _createElementVNode("option", null, "饮品"),
                    _createElementVNode("option", null, "其他")
                  ], 8, ["onUpdate:modelValue"]), [
                    [_vModelSelect, _ctx.form.category]
                  ])
                ]),
                _createElementVNode("label", null, [
                  _createTextVNode("联系人"),
                  _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": ($event) => _ctx.form.contactName = $event,
                    required: "",
                    maxlength: "50"
                  }, null, 8, ["onUpdate:modelValue"]), [
                    [
                      _vModelText,
                      _ctx.form.contactName,
                      void 0,
                      { trim: true }
                    ]
                  ])
                ]),
                _createElementVNode("label", null, [
                  _createTextVNode("联系电话"),
                  _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": ($event) => _ctx.form.contactPhone = $event,
                    required: "",
                    maxlength: "30"
                  }, null, 8, ["onUpdate:modelValue"]), [
                    [
                      _vModelText,
                      _ctx.form.contactPhone,
                      void 0,
                      { trim: true }
                    ]
                  ])
                ]),
                _createElementVNode("label", null, [
                  _createTextVNode("首个门店名称"),
                  _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": ($event) => _ctx.form.storeName = $event,
                    required: "",
                    maxlength: "100"
                  }, null, 8, ["onUpdate:modelValue"]), [
                    [
                      _vModelText,
                      _ctx.form.storeName,
                      void 0,
                      { trim: true }
                    ]
                  ])
                ]),
                _createElementVNode("label", null, [
                  _createTextVNode("自提位置"),
                  _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": ($event) => _ctx.form.location = $event,
                    required: "",
                    maxlength: "200",
                    placeholder: "如：学一食堂一层"
                  }, null, 8, ["onUpdate:modelValue"]), [
                    [
                      _vModelText,
                      _ctx.form.location,
                      void 0,
                      { trim: true }
                    ]
                  ])
                ]),
                _createElementVNode("button", {
                  class: "teal-button",
                  type: "submit",
                  disabled: _ctx.preview || _ctx.busy || !_ctx.store.user
                }, _toDisplayString(!_ctx.store.user && !_ctx.preview ? "请先登录" : "提交入驻申请"), 9, ["disabled"])
              ], 40, ["onSubmit"])) : (_openBlock(), _createElementBlock("section", {
                key: 2,
                class: "detail-card"
              }, [
                _createElementVNode("h2", null, "收到的邀请"),
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.invitations, (i) => {
                    return _openBlock(), _createElementBlock("div", {
                      class: "invitation-line",
                      key: i.id
                    }, [
                      _createElementVNode("div", null, [
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(i.merchantId),
                          1
                          /* TEXT */
                        ),
                        _createElementVNode(
                          "small",
                          null,
                          _toDisplayString(_ctx.invitationIsExpired(i) ? "已过期" : _ctx.invitationStatusLabel(i.status)),
                          1
                          /* TEXT */
                        )
                      ]),
                      _createElementVNode("button", {
                        class: "outline-button",
                        disabled: _ctx.preview || _ctx.busy || _ctx.loading || i.status !== "PENDING" || _ctx.invitationIsExpired(i),
                        onClick: ($event) => _ctx.accept(i)
                      }, "接受", 8, ["disabled", "onClick"])
                    ]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                )),
                !_ctx.loading && !_ctx.error && !_ctx.invitations.length ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "mobile-empty"
                }, "暂无邀请")) : _createCommentVNode("v-if", true),
                !_ctx.preview && (_ctx.invitePage > 1 || _ctx.invitations.length === 20) ? (_openBlock(), _createElementBlock("div", {
                  key: 1,
                  class: "sdd-pager"
                }, [
                  _createElementVNode("button", {
                    disabled: _ctx.loading || _ctx.invitePage <= 1,
                    onClick: ($event) => _ctx.invitePage--
                  }, "上一页", 8, ["disabled", "onClick"]),
                  _createElementVNode(
                    "span",
                    null,
                    _toDisplayString(_ctx.invitePage),
                    1
                    /* TEXT */
                  ),
                  _createElementVNode("button", {
                    disabled: _ctx.loading || _ctx.invitations.length < 20,
                    onClick: ($event) => _ctx.invitePage++
                  }, "下一页", 8, ["disabled", "onClick"])
                ])) : _createCommentVNode("v-if", true)
              ])),
              _ctx.login ? (_openBlock(), _createBlock(_component_AuthDialog, {
                key: 3,
                onClose: ($event) => _ctx.login = false,
                onSuccess: _ctx.load
              }, null, 8, ["onClose", "onSuccess"])) : _createCommentVNode("v-if", true)
            ];
          }),
          _: 1
          /* STABLE */
        });
      };
    })()
  };
  const { ref: ref$5, computed: computed$5, watch: watch$4, nextTick, onMounted: onMounted$4, onUnmounted: onUnmounted$4 } = Vue;
  const merchantNav = [
    ["home", "工作台", "/merchant"],
    ["package", "商品管理", "/merchant/products"],
    ["box", "库存管理", "/merchant/inventory"],
    ["order", "订单管理", "/merchant/orders"],
    ["scan", "自提核销", "/merchant/pickup"],
    ["clipboard", "售后处理", "/merchant/aftersales"],
    ["users", "店员管理", "/merchant/team"],
    ["shield", "角色权限", "/merchant/roles"],
    ["book", "知识库", "/merchant/knowledge"],
    ["search", "RAG 调试", "/merchant/knowledge/debug"],
    ["settings", "门店设置", "/merchant/settings"]
  ];
  const adminNav = [
    ["home", "平台总览", "/admin"],
    ["store", "商户审核", "/admin/applications"],
    ["users", "商户监管", "/admin/merchants"],
    ["package", "商品监管", "/admin/products"],
    ["order", "订单监管", "/admin/orders"],
    ["shield", "争议处理", "/admin/disputes"],
    ["book", "知识库", "/admin/knowledge"],
    ["search", "RAG 调试", "/admin/knowledge/debug"],
    ["grid", "分类管理", "/admin/categories"]
  ];
  const BackofficeShell = {
    name: "BackofficeShell",
    props: { role: { type: String, default: "merchant" }, title: String },
    components: { AuthDialog },
    setup() {
      const loginOpen = ref$5(false), mobileNav = ref$5(null);
      const required = {
        "/merchant": "order.read",
        "/merchant/products": "product.read",
        "/merchant/inventory": "stock.read",
        "/merchant/orders": "order.read",
        "/merchant/pickup": "pickup.verify",
        "/merchant/aftersales": "aftersale.read",
        "/merchant/team": "team.manage",
        "/merchant/roles": "role.manage",
        "/merchant/knowledge": "knowledge.read",
        "/merchant/knowledge/debug": "knowledge.read",
        "/merchant/settings": "store.manage"
      };
      const visibleMerchantNav = computed$5(
        () => merchantNav.filter(([, , path]) => hasPermission(required[path]))
      );
      const alignMobileNav = () => {
        var _a;
        const nav = mobileNav.value;
        if (nav == null ? void 0 : nav.clientWidth)
          (_a = nav.querySelector("button.active")) == null ? void 0 : _a.scrollIntoView({ inline: "center", block: "nearest" });
      };
      watch$4(
        [() => store.route, () => visibleMerchantNav.value.map((item) => item[2]).join("|")],
        async () => {
          await nextTick();
          alignMobileNav();
        },
        { immediate: true, flush: "post" }
      );
      onMounted$4(() => window.addEventListener("resize", alignMobileNav));
      onUnmounted$4(() => window.removeEventListener("resize", alignMobileNav));
      async function switchShop(e) {
        if (preview) {
          notify("演示模式不能切换真实商户");
          return;
        }
        switchMerchantContext(e.target.value);
      }
      return {
        store,
        go,
        preview,
        loginOpen,
        mobileNav,
        merchantNav,
        visibleMerchantNav,
        adminNav,
        switchShop
      };
    },
    render: (() => {
      const { createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, createTextVNode: _createTextVNode, renderList: _renderList, Fragment: _Fragment, openBlock: _openBlock, createElementBlock: _createElementBlock, resolveComponent: _resolveComponent, createVNode: _createVNode2, createCommentVNode: _createCommentVNode, normalizeClass: _normalizeClass, renderSlot: _renderSlot, createBlock: _createBlock } = Vue;
      return function render2(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_AuthDialog = _resolveComponent("AuthDialog");
        return _openBlock(), _createElementBlock("div", { class: "merchant-shell" }, [
          _createElementVNode("aside", { class: "merchant-sidebar" }, [
            _createElementVNode("button", {
              class: "merchant-brand",
              onClick: ($event) => _ctx.go("/")
            }, [
              _createElementVNode("span", { class: "brand-pin" }, [
                _createElementVNode("span")
              ]),
              _createElementVNode("span", { class: "brand-word" }, [
                _createTextVNode("青柠校园 "),
                _createElementVNode(
                  "span",
                  { class: "brand-suffix" },
                  "/ " + _toDisplayString(_ctx.role === "admin" ? "平台端" : "商户端"),
                  1
                  /* TEXT */
                )
              ])
            ], 8, ["onClick"]),
            _createElementVNode("nav", { class: "merchant-nav" }, [
              (_openBlock(true), _createElementBlock(
                _Fragment,
                null,
                _renderList(_ctx.role === "admin" ? _ctx.adminNav : _ctx.visibleMerchantNav, ([ico, label, path]) => {
                  return _openBlock(), _createElementBlock("button", {
                    key: path,
                    class: _normalizeClass({ active: _ctx.store.route === path }),
                    onClick: ($event) => _ctx.go(path)
                  }, [
                    _createVNode2(_component_Icon, {
                      name: ico,
                      size: 19
                    }, null, 8, ["name"]),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(label),
                      1
                      /* TEXT */
                    ),
                    _ctx.store.route === path ? (_openBlock(), _createElementBlock("span", {
                      key: 0,
                      class: "nav-left-bar"
                    })) : _createCommentVNode("v-if", true)
                  ], 10, ["onClick"]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ]),
            _createElementVNode("div", { class: "merchant-sidebar-bottom" }, [
              _createElementVNode("button", {
                class: "sidebar-back",
                onClick: ($event) => _ctx.go("/")
              }, [
                _createVNode2(_component_Icon, {
                  name: "arrowLeft",
                  size: 16
                }),
                _createTextVNode(" 返回购物端")
              ], 8, ["onClick"])
            ])
          ]),
          _createElementVNode("div", { class: "merchant-content-shell" }, [
            _createElementVNode("header", { class: "merchant-topbar" }, [
              _createElementVNode("div", { class: "topbar-crumb" }, [
                _createTextVNode(
                  _toDisplayString(_ctx.role === "admin" ? "平台运营" : "店铺运营") + " ",
                  1
                  /* TEXT */
                ),
                _createVNode2(_component_Icon, {
                  name: "chevronRight",
                  size: 14
                }),
                _createElementVNode(
                  "strong",
                  null,
                  _toDisplayString(_ctx.title),
                  1
                  /* TEXT */
                )
              ]),
              _createElementVNode("div", { class: "merchant-topbar-tools" }, [
                _ctx.preview ? (_openBlock(), _createElementBlock("span", {
                  key: 0,
                  class: "admin-preview-tag"
                }, "设计预览")) : _createCommentVNode("v-if", true),
                _ctx.role === "merchant" ? (_openBlock(), _createElementBlock("label", {
                  key: 1,
                  class: "topbar-merchant-select"
                }, [
                  _createVNode2(_component_Icon, {
                    name: "store",
                    size: 16
                  }),
                  _createElementVNode("select", {
                    value: _ctx.store.merchantId,
                    onChange: _ctx.switchShop,
                    disabled: _ctx.preview || _ctx.store.loading
                  }, [
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.store.merchants, (m) => {
                        return _openBlock(), _createElementBlock("option", {
                          key: m.merchantId,
                          value: m.merchantId
                        }, _toDisplayString(m.name), 9, ["value"]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ], 40, ["value", "onChange", "disabled"])
                ])) : _createCommentVNode("v-if", true),
                _createElementVNode("button", {
                  class: "topbar-avatar",
                  onClick: ($event) => _ctx.loginOpen = true
                }, [
                  _createVNode2(_component_Icon, {
                    name: "user",
                    size: 18
                  })
                ], 8, ["onClick"])
              ])
            ]),
            _createElementVNode(
              "nav",
              {
                ref: "mobileNav",
                class: "merchant-mobile-nav",
                "aria-label": "工作台导航"
              },
              [
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.role === "admin" ? _ctx.adminNav : _ctx.visibleMerchantNav, ([ico, label, path]) => {
                    return _openBlock(), _createElementBlock("button", {
                      key: path,
                      class: _normalizeClass({ active: _ctx.store.route === path }),
                      onClick: ($event) => _ctx.go(path)
                    }, [
                      _createVNode2(_component_Icon, {
                        name: ico,
                        size: 16
                      }, null, 8, ["name"]),
                      _createTextVNode(
                        _toDisplayString(label),
                        1
                        /* TEXT */
                      )
                    ], 10, ["onClick"]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ],
              512
              /* NEED_PATCH */
            ),
            _createElementVNode("main", { class: "merchant-main" }, [
              _createElementVNode("div", { class: "merchant-page-heading" }, [
                _createElementVNode("div", null, [
                  _createElementVNode(
                    "h1",
                    null,
                    _toDisplayString(_ctx.title),
                    1
                    /* TEXT */
                  )
                ]),
                _renderSlot(_ctx.$slots, "actions")
              ]),
              _ctx.store.error ? (_openBlock(), _createElementBlock(
                "div",
                {
                  key: 0,
                  class: "inline-error merchant-error"
                },
                _toDisplayString(_ctx.store.error),
                1
                /* TEXT */
              )) : _createCommentVNode("v-if", true),
              _renderSlot(_ctx.$slots, "default")
            ])
          ]),
          _ctx.loginOpen ? (_openBlock(), _createBlock(_component_AuthDialog, {
            key: 0,
            onClose: ($event) => _ctx.loginOpen = false,
            onSuccess: ($event) => _ctx.role === "merchant" ? _ctx.loadMerchant() : null
          }, null, 8, ["onClose", "onSuccess"])) : _createCommentVNode("v-if", true)
        ]);
      };
    })()
  };
  const { ref: ref$4, computed: computed$4, onMounted: onMounted$3, onUnmounted: onUnmounted$3, watch: watch$3 } = Vue;
  const names = {
    "/merchant": "经营概览",
    "/merchant/inventory": "库存管理",
    "/merchant/orders": "订单管理",
    "/merchant/pickup": "自提核销",
    "/merchant/aftersales": "售后处理",
    "/merchant/team": "店员管理",
    "/merchant/settings": "门店设置"
  };
  const MerchantOps = {
    name: "MerchantOps",
    components: { BackofficeShell, ProductImage },
    setup() {
      const scope = requestScope();
      const route = computed$4(() => store.route);
      const title = computed$4(() => names[route.value] || "经营概览");
      const filter = ref$4("");
      const pickupState = ref$4(route.value === "/merchant/pickup" ? "READY" : "");
      const q = ref$4("");
      const statsPeriod = ref$4(7);
      const stats = ref$4(null), orders = ref$4([]), afterSales = ref$4([]), members = ref$4([]), moves = ref$4([]), stockRows = ref$4([]), error = ref$4(""), loading = ref$4(false), busy = ref$4(false), picked = ref$4(null), token = ref$4(""), decision = ref$4(""), reason = ref$4(""), historyEvents = ref$4([]), historyLoading = ref$4(false), historyError = ref$4("");
      const availableBelow = ref$4(null);
      const movementQ = ref$4("");
      const movementPage = ref$4(1);
      const movementPageInfo = ref$4({ total: 0, hasNext: false });
      let historyVersion = 0;
      const page = ref$4(1), pageInfo = ref$4({ total: 0, hasNext: false }), amount = ref$4(1), sku2 = ref$4(""), inviteUser = ref$4(""), profile = ref$4({
        name: "",
        storeName: "",
        location: "",
        description: "",
        businessHours: "",
        imageUrl: ""
      });
      const replenishKey = ref$4(""), replenishFingerprint = ref$4("");
      const merchant = computed$4(
        () => store.merchants.find((m) => m.merchantId === store.merchantId) || {}
      );
      const skuRows = computed$4(
        () => !preview && route.value === "/merchant/inventory" ? stockRows.value.map((s) => ({
          product: { title: s.productTitle || s.skuId, imageUrl: s.imageUrl || "" },
          sku: { skuId: s.skuId, specKey: s.specKey || "规格" },
          stock: s
        })) : store.products.flatMap(
          (p2) => (p2.skus || []).map((s) => ({
            product: p2,
            sku: s,
            stock: store.stocks.find((x) => x.skuId === s.skuId)
          }))
        )
      );
      const visibleOrders = computed$4(
        () => !preview ? orders.value : orders.value.filter(
          (o) => {
            var _a, _b, _c;
            return (!filter.value || o.status === filter.value) && (!pickupState.value || ((_a = o.pickup) == null ? void 0 : _a.status) === pickupState.value) && (!q.value || ((_b = o.orderId) == null ? void 0 : _b.toLowerCase().includes(q.value.toLowerCase())) || ((_c = o.items) == null ? void 0 : _c.some((i) => {
              var _a2;
              return (_a2 = i.title) == null ? void 0 : _a2.includes(q.value);
            })));
          }
        )
      );
      const selectedOrder = computed$4(
        () => orders.value.find((o) => o.orderId === picked.value) || visibleOrders.value[0] || null
      );
      const canOwner = computed$4(() => isOwner());
      const can = computed$4(() => (code) => hasPermission(code));
      const roles = ref$4([]);
      const routePermission = {
        "/merchant": "order.read",
        "/merchant/inventory": "stock.read",
        "/merchant/orders": "order.read",
        "/merchant/pickup": "pickup.verify",
        "/merchant/aftersales": "aftersale.read",
        "/merchant/team": "team.manage",
        "/merchant/settings": "store.manage"
      };
      const restricted = computed$4(
        () => !preview && !hasPermission(routePermission[route.value] || "order.read")
      );
      const canAct = computed$4(
        () => !preview && !busy.value && !loading.value && !error.value && !!store.merchantId && !restricted.value
      );
      let loadVersion = 0;
      async function load() {
        var _a, _b;
        const request2 = scope.begin();
        const read = (path) => api(path, { signal: request2.signal });
        const stamp = ++loadVersion;
        const section = route.value;
        error.value = "";
        if (!store.merchantId) await loadMerchant();
        if (stamp !== loadVersion) return;
        const mid = store.merchantId;
        if (!mid) {
          error.value = store.error || "尚未加入商户";
          return;
        }
        if (restricted.value) return;
        if (preview) {
          pageInfo.value = { total: DEMO_MERCHANT_ORDERS.length, hasNext: false };
          stats.value = { ...DEMO_STATS };
          orders.value = DEMO_MERCHANT_ORDERS.map((o) => ({ ...o }));
          members.value = DEMO_MEMBERS;
          afterSales.value = DEMO_AFTERSALES;
          moves.value = DEMO_STOCK_MOVES;
          profile.value = {
            name: merchant.value.name || "东湖便利",
            storeName: merchant.value.storeName || "学一食堂店",
            location: merchant.value.location || "东湖校区"
          };
          return;
        }
        const base = "/merchants/" + pathId(mid);
        const actor = (_a = store.user) == null ? void 0 : _a.userId;
        const current = () => {
          var _a2;
          return stamp === loadVersion && route.value === section && store.merchantId === mid && ((_a2 = store.user) == null ? void 0 : _a2.userId) === actor;
        };
        loading.value = true;
        try {
          if (section === "/merchant") {
            const [s, o] = await Promise.all([
              hasPermission("dashboard.read") ? read(base + "/statistics/operations" + query({ periodDays: statsPeriod.value })) : Promise.resolve(null),
              read(base + "/orders/page" + query({ page: 1, size: 5 }))
            ]);
            if (!current()) return;
            stats.value = s;
            orders.value = o.items || [];
            pageInfo.value = o;
          }
          if (section === "/merchant/orders" || section === "/merchant/pickup") {
            const result = await read(
              base + "/orders/page" + query({
                page: page.value,
                size: 10,
                state: filter.value,
                pickupState: pickupState.value,
                q: q.value
              })
            );
            if (!current()) return;
            if (((_b = result.items) == null ? void 0 : _b.length) === 0 && page.value > 1 && result.total > 0) {
              page.value = Math.max(1, Math.ceil(result.total / 10));
              return;
            }
            orders.value = result.items || [];
            pageInfo.value = result;
          }
          if (section === "/merchant/aftersales") {
            const result = await read(
              base + "/aftersales/page" + query({ page: page.value, size: 10 })
            );
            if (!current()) return;
            afterSales.value = result.items || [];
            pageInfo.value = result;
          }
          if (section === "/merchant/inventory") {
            const [stockResult, movements] = await Promise.all([
              read(
                base + "/stocks/page" + query({
                  page: page.value,
                  size: 10,
                  q: q.value,
                  availableBelow: availableBelow.value
                })
              ),
              read(
                base + "/stock-movements/page" + query({ page: movementPage.value, size: 8, q: movementQ.value })
              )
            ]);
            if (!current()) return;
            stockRows.value = stockResult.items || [];
            moves.value = movements.items || [];
            movementPageInfo.value = movements;
            pageInfo.value = stockResult;
          }
          if (section === "/merchant/team") {
            const [m, r] = await Promise.all([read(base + "/members"), read(base + "/rbac/roles")]);
            if (!current()) return;
            members.value = m || [];
            roles.value = r || [];
          }
          if (section === "/merchant/settings" && current())
            profile.value = {
              name: merchant.value.name || "",
              storeName: merchant.value.storeName || "",
              location: merchant.value.location || "",
              description: merchant.value.description || "",
              businessHours: merchant.value.businessHours || "",
              imageUrl: merchant.value.imageUrl || ""
            };
        } catch (e) {
          if (current()) error.value = e.message;
        } finally {
          if (current()) loading.value = false;
        }
      }
      onMounted$3(load);
      onUnmounted$3(() => {
        ++loadVersion;
        clearTimeout(searchDelay);
      });
      let searchDelay;
      let resettingPage = false;
      watch$3(
        [page, q, filter, pickupState, availableBelow, movementQ, statsPeriod],
        (next, previous) => {
          if (resettingPage) return;
          clearTimeout(searchDelay);
          ++loadVersion;
          loading.value = true;
          const changed = next.slice(1).some((v, i) => v !== previous[i + 1]);
          if (changed) {
            resettingPage = true;
            page.value = 1;
            if (next[4] !== previous[4] || next[5] !== previous[5]) movementPage.value = 1;
            resettingPage = false;
          }
          searchDelay = setTimeout(load, next[1] !== previous[1] ? 280 : 0);
        },
        { flush: "sync" }
      );
      watch$3(movementPage, () => {
        if (route.value === "/merchant/inventory") load();
      });
      async function perform(url, body, method = "POST", key) {
        if (!canAct.value) return;
        const current = scope.capture();
        busy.value = true;
        try {
          await api(url, { method, body, key });
          if (!current()) return false;
          notify("操作成功");
          token.value = "";
          await load();
          return current();
        } catch (e) {
          if (current()) notify(e.message);
          return false;
        } finally {
          if (current()) busy.value = false;
        }
      }
      function midPath() {
        return "/merchants/" + pathId(store.merchantId);
      }
      function orderReminder(o) {
        var _a, _b;
        const now = Date.now();
        const deadline = (o == null ? void 0 : o.deadline) ? Date.parse(o.deadline) : NaN;
        if ((o == null ? void 0 : o.status) === "PENDING_PAYMENT" && Number.isFinite(deadline)) {
          if (deadline <= now) return "付款已超时";
          if (deadline - now <= 15 * 60 * 1e3) return "付款即将超时";
        }
        const pickupExpires = ((_a = o == null ? void 0 : o.pickup) == null ? void 0 : _a.expiresAt) ? Date.parse(o.pickup.expiresAt) : NaN;
        if (((_b = o == null ? void 0 : o.pickup) == null ? void 0 : _b.status) === "READY" && Number.isFinite(pickupExpires) && pickupExpires <= now)
          return "自提凭证已过期";
        return "";
      }
      async function prepare(o, ready) {
        await perform(midPath() + "/orders/" + pathId(o.orderId) + (ready ? "/ready" : "/prepare"));
      }
      async function verify(o) {
        if (!token.value.trim()) {
          notify("请输入买家出示的自提令牌");
          return;
        }
        await perform(midPath() + "/orders/" + pathId(o.orderId) + "/verify", {
          token: token.value.trim()
        });
      }
      async function replenish() {
        if (!hasPermission("stock.replenish")) return;
        if (!positiveInt(amount.value, 1e6)) {
          notify("补货数量须为1~1000000");
          return;
        }
        if (!sku2.value) return;
        const f = store.merchantId + ":" + sku2.value + ":" + Number(amount.value);
        if (replenishFingerprint.value !== f) {
          replenishFingerprint.value = f;
          replenishKey.value = idempotency();
        }
        if (await perform(
          midPath() + "/stocks/" + pathId(sku2.value) + "/replenish",
          { quantity: Number(amount.value) },
          "POST",
          replenishKey.value
        )) {
          replenishKey.value = "";
          replenishFingerprint.value = "";
        }
      }
      async function invite() {
        if (!canOwner.value || !inviteUser.value.trim()) return;
        if (await perform(midPath() + "/invitations", { username: inviteUser.value.trim() }))
          inviteUser.value = "";
      }
      async function revoke(m) {
        if (!canOwner.value || m.role === "OWNER" || m.status !== "ACTIVE") return;
        if (!window.confirm("确定撤销该成员的商户权限？")) return;
        await perform(midPath() + "/members/" + pathId(m.userId), void 0, "DELETE");
      }
      async function assignMember(m, event) {
        const code = event.target.value;
        event.target.value = m.role;
        if (!canOwner.value || !code || code === m.role || m.role === "OWNER") return;
        await perform(
          midPath() + "/rbac/members/" + pathId(m.userId) + "/role",
          { roleCode: code },
          "PUT"
        );
      }
      async function saveProfile() {
        if (!canOwner.value || !canAct.value) return;
        const current = scope.capture();
        const v = profile.value;
        if (!v.name.trim() || !v.storeName.trim() || !v.location.trim()) {
          notify("请完善门店资料");
          return;
        }
        busy.value = true;
        try {
          const saved = await api(midPath() + "/profile", { method: "PUT", body: { ...v } });
          if (!current()) return;
          const index = store.merchants.findIndex((m) => m.merchantId === saved.merchantId);
          if (index >= 0) store.merchants[index] = saved;
          if (store.workspace) store.workspace.merchants = store.merchants;
          profile.value = {
            name: saved.name,
            storeName: saved.storeName,
            location: saved.location,
            description: saved.description || "",
            businessHours: saved.businessHours || "",
            imageUrl: saved.imageUrl || ""
          };
          notify("门店资料已保存");
        } catch (e) {
          if (current()) notify(e.message);
        } finally {
          if (current()) busy.value = false;
        }
      }
      async function uploadStoreImage(event) {
        var _a;
        if (!canOwner.value || !canAct.value || busy.value) return;
        const input = event.target;
        const file = (_a = input.files) == null ? void 0 : _a[0];
        input.value = "";
        if (!file) return;
        if (!file.type.startsWith("image/") || file.size > 2e6) {
          notify("请选择 2MB 以内的图片");
          return;
        }
        const current = scope.capture();
        busy.value = true;
        try {
          const base64 = await new Promise((resolve2, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve2(String(reader.result || "").split(",")[1] || "");
            reader.onerror = () => reject(new Error("图片读取失败"));
            reader.readAsDataURL(file);
          });
          if (!current()) return;
          const uploaded = await api(midPath() + "/store/images", {
            method: "POST",
            body: { filename: file.name, contentType: file.type, base64 }
          });
          if (!current()) return;
          profile.value.imageUrl = uploaded.url;
          notify("门店图片已上传，保存设置后生效");
        } catch (e) {
          if (current()) notify(e.message);
        } finally {
          if (current()) busy.value = false;
        }
      }
      async function openAfterSaleDecision(orderId) {
        const version2 = ++historyVersion;
        decision.value = orderId;
        reason.value = "";
        historyEvents.value = [];
        historyError.value = "";
        if (preview) return;
        historyLoading.value = true;
        try {
          const events = await api(midPath() + "/orders/" + pathId(orderId) + "/after-sale-history");
          if (version2 !== historyVersion || decision.value !== orderId) return;
          historyEvents.value = (events || []).filter(
            (e) => e.type.startsWith("REFUND_") || e.type.startsWith("MERCHANT_") || e.type.startsWith("PLATFORM_")
          );
        } catch (e) {
          if (version2 === historyVersion) historyError.value = e.message;
        } finally {
          if (version2 === historyVersion) historyLoading.value = false;
        }
      }
      async function decisionAction(s, approved) {
        var _a;
        if (!hasPermission("aftersale.review") || !s) return;
        if (((_a = afterSales.value.find((row) => row.id === s.id)) == null ? void 0 : _a.status) !== "REQUESTED") {
          notify("该售后已不处于待审核状态，请刷新列表");
          return;
        }
        const comment = reason.value.trim();
        if (!comment) {
          notify("请填写退款审核说明");
          return;
        }
        if (await perform(midPath() + "/orders/" + pathId(s.orderId) + "/refund-decision", {
          approved,
          reason: comment
        }))
          reason.value = "";
      }
      const topOrders = computed$4(() => orders.value.slice(0, 5));
      const merchantName = computed$4(() => merchant.value.name || "校内商户");
      return {
        store,
        go,
        preview,
        route,
        title,
        filter,
        pickupState,
        q,
        page,
        pageInfo,
        statsPeriod,
        stats,
        orders,
        afterSales,
        members,
        moves,
        stockRows,
        availableBelow,
        movementQ,
        movementPage,
        movementPageInfo,
        error,
        busy,
        loading,
        picked,
        selectedOrder,
        visibleOrders,
        token,
        decision,
        reason,
        historyEvents,
        historyLoading,
        historyError,
        orderEventLabel,
        openAfterSaleDecision,
        amount,
        sku: sku2,
        skuRows,
        inviteUser,
        profile,
        merchantName,
        merchant,
        topOrders,
        canOwner,
        can,
        roles,
        assignMember,
        restricted,
        canAct,
        money,
        inventoryQuantityLabel,
        afterSaleStatusLabel,
        inventoryOperationLabel,
        membershipStatusLabel,
        orderStatusLabel,
        pickupStatusLabel,
        orderReminder,
        dateTime,
        coverSku,
        load,
        prepare,
        verify,
        replenish,
        invite,
        revoke,
        saveProfile,
        uploadStoreImage,
        decisionAction
      };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode2, createTextVNode: _createTextVNode, createElementVNode: _createElementVNode, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, toDisplayString: _toDisplayString, normalizeClass: _normalizeClass, renderList: _renderList, Fragment: _Fragment, vModelText: _vModelText, withDirectives: _withDirectives, vModelSelect: _vModelSelect, withModifiers: _withModifiers, withCtx: _withCtx, createBlock: _createBlock } = Vue;
      return function render2(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_BackofficeShell = _resolveComponent("BackofficeShell");
        return _openBlock(), _createBlock(_component_BackofficeShell, {
          role: "merchant",
          title: _ctx.title
        }, {
          actions: _withCtx(() => [
            _createElementVNode("button", {
              class: "outline-button small",
              onClick: _ctx.load
            }, [
              _createVNode2(_component_Icon, {
                name: "refresh",
                size: 16
              }),
              _createTextVNode("刷新")
            ], 8, ["onClick"])
          ]),
          default: _withCtx(() => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            return [
              _ctx.loading ? (_openBlock(), _createElementBlock("div", {
                key: 0,
                class: "inline-loading",
                role: "status"
              }, "正在加载…")) : _createCommentVNode("v-if", true),
              _ctx.error ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "inline-error"
              }, [
                _createTextVNode(
                  _toDisplayString(_ctx.error) + " ",
                  1
                  /* TEXT */
                ),
                _createElementVNode("button", { onClick: _ctx.load }, "重试", 8, ["onClick"])
              ])) : _createCommentVNode("v-if", true),
              _ctx.restricted ? (_openBlock(), _createElementBlock("div", {
                key: 2,
                class: "ops-card access-denied"
              }, [
                _createVNode2(_component_Icon, {
                  name: "shield",
                  size: 32
                }),
                _createElementVNode("h2", null, "无权限访问")
              ])) : _ctx.route === "/merchant" ? (_openBlock(), _createElementBlock(
                _Fragment,
                { key: 3 },
                [
                  _createElementVNode("div", { class: "ops-card stats-toolbar" }, [
                    _createElementVNode(
                      "span",
                      null,
                      "统计期间：近 " + _toDisplayString(_ctx.statsPeriod) + " 天",
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("button", {
                      class: _normalizeClass({ active: _ctx.statsPeriod === 7 }),
                      onClick: ($event) => _ctx.statsPeriod = 7
                    }, "7 天", 10, ["onClick"]),
                    _createElementVNode("button", {
                      class: _normalizeClass({ active: _ctx.statsPeriod === 30 }),
                      onClick: ($event) => _ctx.statsPeriod = 30
                    }, "30 天", 10, ["onClick"]),
                    _ctx.stats ? (_openBlock(), _createElementBlock(
                      "small",
                      { key: 0 },
                      _toDisplayString(_ctx.stats.periodStart) + " 至 " + _toDisplayString(_ctx.stats.periodEnd) + " · " + _toDisplayString(_ctx.stats.timezone) + " · 截至 " + _toDisplayString(_ctx.stats.asOf),
                      1
                      /* TEXT */
                    )) : _createCommentVNode("v-if", true)
                  ]),
                  _ctx.stats ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "ops-kpis"
                  }, [
                    _createElementVNode("div", null, [
                      _createElementVNode("span", null, "订单总数"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.stats.totalOrders || 0),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createElementVNode("div", null, [
                      _createElementVNode("span", null, "成功支付"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.stats.paidOrders || 0),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createElementVNode("div", null, [
                      _createElementVNode("span", null, "整单退款"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.stats.refundedOrders || 0),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createElementVNode("div", null, [
                      _createElementVNode("span", null, "完成金额"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.money(_ctx.stats.completedAmountCent)),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createElementVNode("div", null, [
                      _createElementVNode("span", null, "退款率"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.stats.refundRate == null ? "—" : (_ctx.stats.refundRate * 100).toFixed(1) + "%"),
                        1
                        /* TEXT */
                      )
                    ])
                  ])) : _createCommentVNode("v-if", true),
                  _ctx.stats ? (_openBlock(), _createElementBlock("div", {
                    key: 1,
                    class: "ops-grid"
                  }, [
                    _createElementVNode("section", { class: "ops-card" }, [
                      _createElementVNode("div", { class: "ops-card-header" }, [
                        _createElementVNode("h2", null, "订单趋势"),
                        _createElementVNode("span", null, "新增订单")
                      ]),
                      (_openBlock(true), _createElementBlock(
                        _Fragment,
                        null,
                        _renderList(_ctx.stats.trend, (item) => {
                          return _openBlock(), _createElementBlock("div", {
                            class: "ops-list-line",
                            key: item.day
                          }, [
                            _createElementVNode("div", null, [
                              _createElementVNode(
                                "strong",
                                null,
                                _toDisplayString(item.day),
                                1
                                /* TEXT */
                              ),
                              _createElementVNode("small", null, "按创建日")
                            ]),
                            _createElementVNode(
                              "b",
                              null,
                              _toDisplayString(item.orderCount),
                              1
                              /* TEXT */
                            )
                          ]);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      )),
                      !((_a = _ctx.stats.trend) == null ? void 0 : _a.length) ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "admin-empty"
                      }, "期间暂无订单")) : _createCommentVNode("v-if", true)
                    ]),
                    _createElementVNode("section", { class: "ops-card" }, [
                      _createElementVNode("div", { class: "ops-card-header" }, [
                        _createElementVNode("h2", null, "商品表现"),
                        _createElementVNode("span", null, "已完成 SKU")
                      ]),
                      (_openBlock(true), _createElementBlock(
                        _Fragment,
                        null,
                        _renderList(_ctx.stats.products, (item) => {
                          return _openBlock(), _createElementBlock("div", {
                            class: "ops-list-line",
                            key: item.skuId
                          }, [
                            _createElementVNode("div", null, [
                              _createElementVNode(
                                "strong",
                                null,
                                _toDisplayString(item.title || item.skuId),
                                1
                                /* TEXT */
                              ),
                              _createElementVNode(
                                "small",
                                null,
                                _toDisplayString(item.skuId),
                                1
                                /* TEXT */
                              )
                            ]),
                            _createElementVNode(
                              "b",
                              null,
                              _toDisplayString(item.quantity),
                              1
                              /* TEXT */
                            )
                          ]);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      )),
                      !((_b = _ctx.stats.products) == null ? void 0 : _b.length) ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "admin-empty"
                      }, "期间暂无已完成商品")) : _createCommentVNode("v-if", true)
                    ]),
                    _createElementVNode("section", { class: "ops-card" }, [
                      _createElementVNode("div", { class: "ops-card-header" }, [
                        _createElementVNode("h2", null, "状态分布"),
                        _createElementVNode("span", null, "查询时事实")
                      ]),
                      (_openBlock(true), _createElementBlock(
                        _Fragment,
                        null,
                        _renderList(_ctx.stats.statuses, (item) => {
                          return _openBlock(), _createElementBlock("div", {
                            class: "ops-list-line",
                            key: item.status
                          }, [
                            _createElementVNode("div", null, [
                              _createElementVNode(
                                "strong",
                                null,
                                _toDisplayString(_ctx.orderStatusLabel(item.status)),
                                1
                                /* TEXT */
                              ),
                              _createElementVNode(
                                "small",
                                null,
                                _toDisplayString(item.orderCount) + " 单",
                                1
                                /* TEXT */
                              )
                            ]),
                            _createElementVNode(
                              "b",
                              null,
                              _toDisplayString(_ctx.money(item.amountCent)),
                              1
                              /* TEXT */
                            )
                          ]);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      )),
                      !((_c = _ctx.stats.statuses) == null ? void 0 : _c.length) ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "admin-empty"
                      }, "期间暂无订单")) : _createCommentVNode("v-if", true)
                    ])
                  ])) : _createCommentVNode("v-if", true),
                  _createElementVNode("div", { class: "ops-grid" }, [
                    _createElementVNode("section", { class: "ops-card" }, [
                      _createElementVNode("div", { class: "ops-card-header" }, [
                        _createElementVNode("h2", null, "最近订单"),
                        _createElementVNode("button", {
                          onClick: ($event) => _ctx.go("/merchant/orders")
                        }, [
                          _createTextVNode("查看全部 "),
                          _createVNode2(_component_Icon, {
                            name: "chevronRight",
                            size: 15
                          })
                        ], 8, ["onClick"])
                      ]),
                      (_openBlock(true), _createElementBlock(
                        _Fragment,
                        null,
                        _renderList(_ctx.topOrders, (o) => {
                          var _a2, _b2;
                          return _openBlock(), _createElementBlock("div", {
                            class: "ops-list-line",
                            key: o.orderId
                          }, [
                            _createElementVNode("span", { class: "mini-icon" }, [
                              _createVNode2(_component_Icon, {
                                name: "order",
                                size: 19
                              })
                            ]),
                            _createElementVNode("div", null, [
                              _createElementVNode(
                                "strong",
                                null,
                                _toDisplayString(((_b2 = (_a2 = o.items) == null ? void 0 : _a2[0]) == null ? void 0 : _b2.title) || "校园订单"),
                                1
                                /* TEXT */
                              ),
                              _createElementVNode(
                                "small",
                                null,
                                _toDisplayString(o.orderId) + " · " + _toDisplayString(_ctx.dateTime(o.createdAt)),
                                1
                                /* TEXT */
                              )
                            ]),
                            _createElementVNode(
                              "b",
                              null,
                              _toDisplayString(_ctx.money(o.totalCent)),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode(
                              "span",
                              {
                                class: _normalizeClass(["status-tag", o.status === "COMPLETED" ? "published" : "draft"])
                              },
                              _toDisplayString(_ctx.orderStatusLabel(o.status)),
                              3
                              /* TEXT, CLASS */
                            )
                          ]);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      )),
                      !_ctx.topOrders.length ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "admin-empty"
                      }, "暂无订单")) : _createCommentVNode("v-if", true)
                    ]),
                    _createElementVNode("section", { class: "ops-card" }, [
                      _createElementVNode("div", { class: "ops-card-header" }, [
                        _createElementVNode("h2", null, "快捷操作")
                      ]),
                      _createElementVNode("div", { class: "ops-quick" }, [
                        _ctx.can("product.read") ? (_openBlock(), _createElementBlock("button", {
                          key: 0,
                          onClick: ($event) => _ctx.go("/merchant/products")
                        }, [
                          _createVNode2(_component_Icon, { name: "package" }),
                          _createTextVNode("商品管理")
                        ], 8, ["onClick"])) : _createCommentVNode("v-if", true),
                        _ctx.can("stock.read") ? (_openBlock(), _createElementBlock("button", {
                          key: 1,
                          onClick: ($event) => _ctx.go("/merchant/inventory")
                        }, [
                          _createVNode2(_component_Icon, { name: "box" }),
                          _createTextVNode("库存管理")
                        ], 8, ["onClick"])) : _createCommentVNode("v-if", true),
                        _ctx.can("pickup.verify") ? (_openBlock(), _createElementBlock("button", {
                          key: 2,
                          onClick: ($event) => _ctx.go("/merchant/pickup")
                        }, [
                          _createVNode2(_component_Icon, { name: "scan" }),
                          _createTextVNode("核销")
                        ], 8, ["onClick"])) : _createCommentVNode("v-if", true),
                        _ctx.can("knowledge.read") ? (_openBlock(), _createElementBlock("button", {
                          key: 3,
                          onClick: ($event) => _ctx.go("/merchant/knowledge")
                        }, [
                          _createVNode2(_component_Icon, { name: "book" }),
                          _createTextVNode("知识库")
                        ], 8, ["onClick"])) : _createCommentVNode("v-if", true)
                      ])
                    ])
                  ])
                ],
                64
                /* STABLE_FRAGMENT */
              )) : _ctx.route === "/merchant/inventory" ? (_openBlock(), _createElementBlock("div", {
                key: 4,
                class: "ops-grid inventory-grid"
              }, [
                _createElementVNode("section", { class: "ops-card" }, [
                  _createElementVNode("div", { class: "ops-card-header" }, [
                    _createElementVNode("h2", null, "库存清单"),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.preview ? _ctx.skuRows.length : _ctx.pageInfo.total) + " SKU",
                      1
                      /* TEXT */
                    )
                  ]),
                  _createElementVNode("label", { class: "ops-search" }, [
                    _createVNode2(_component_Icon, {
                      name: "search",
                      size: 17
                    }),
                    _withDirectives(_createElementVNode("input", {
                      "onUpdate:modelValue": ($event) => _ctx.q = $event,
                      placeholder: "商品 / SKU"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.q]
                    ])
                  ]),
                  _createElementVNode("div", { class: "filter-pills secondary-pills" }, [
                    _createElementVNode("button", {
                      class: _normalizeClass({ active: _ctx.availableBelow === null }),
                      onClick: ($event) => _ctx.availableBelow = null
                    }, "全部库存", 10, ["onClick"]),
                    _createElementVNode("button", {
                      class: _normalizeClass({ active: _ctx.availableBelow !== null }),
                      onClick: ($event) => _ctx.availableBelow = 10
                    }, "低可售 ≤ " + _toDisplayString(_ctx.availableBelow === null ? 10 : _ctx.availableBelow), 11, ["onClick"]),
                    _ctx.availableBelow !== null ? _withDirectives((_openBlock(), _createElementBlock("input", {
                      key: 0,
                      class: "admin-input compact-select",
                      type: "number",
                      min: "0",
                      max: "1000000",
                      "onUpdate:modelValue": ($event) => _ctx.availableBelow = $event,
                      "aria-label": "低可售阈值"
                    }, null, 8, ["onUpdate:modelValue"])), [
                      [
                        _vModelText,
                        _ctx.availableBelow,
                        void 0,
                        { number: true }
                      ]
                    ]) : _createCommentVNode("v-if", true)
                  ]),
                  _createElementVNode("div", { class: "ops-table-wrap" }, [
                    _createElementVNode("table", { class: "ops-table" }, [
                      _createElementVNode("thead", null, [
                        _createElementVNode("tr", null, [
                          _createElementVNode("th", null, "商品 / 规格"),
                          _createElementVNode("th", null, "实物"),
                          _createElementVNode("th", null, "预占"),
                          _createElementVNode("th", null, "可售"),
                          _createElementVNode("th", null, "操作")
                        ])
                      ]),
                      _createElementVNode("tbody", null, [
                        (_openBlock(true), _createElementBlock(
                          _Fragment,
                          null,
                          _renderList(_ctx.preview ? _ctx.skuRows.filter((r) => !_ctx.q || r.product.title.includes(_ctx.q) || r.sku.specKey.includes(_ctx.q)) : _ctx.skuRows, (row) => {
                            var _a2, _b2, _c2, _d2;
                            return _openBlock(), _createElementBlock(
                              "tr",
                              {
                                key: row.sku.skuId,
                                class: _normalizeClass({ active: _ctx.sku === row.sku.skuId })
                              },
                              [
                                _createElementVNode("td", null, [
                                  _createElementVNode("div", { class: "table-product-cell" }, [
                                    _createVNode2(_component_ProductImage, {
                                      src: row.product.imageUrl,
                                      alt: row.product.title
                                    }, null, 8, ["src", "alt"]),
                                    _createElementVNode("div", null, [
                                      _createElementVNode(
                                        "strong",
                                        null,
                                        _toDisplayString(row.product.title),
                                        1
                                        /* TEXT */
                                      ),
                                      _createElementVNode(
                                        "span",
                                        null,
                                        _toDisplayString(row.sku.specKey),
                                        1
                                        /* TEXT */
                                      )
                                    ])
                                  ])
                                ]),
                                _createElementVNode(
                                  "td",
                                  null,
                                  _toDisplayString(((_a2 = row.stock) == null ? void 0 : _a2.onHand) ?? "—"),
                                  1
                                  /* TEXT */
                                ),
                                _createElementVNode(
                                  "td",
                                  null,
                                  _toDisplayString(((_b2 = row.stock) == null ? void 0 : _b2.reserved) ?? "—"),
                                  1
                                  /* TEXT */
                                ),
                                _createElementVNode(
                                  "td",
                                  {
                                    class: _normalizeClass({ "red-text": Number(((_c2 = row.stock) == null ? void 0 : _c2.available) || 0) < 10 })
                                  },
                                  _toDisplayString(((_d2 = row.stock) == null ? void 0 : _d2.available) ?? "—"),
                                  3
                                  /* TEXT, CLASS */
                                ),
                                _createElementVNode("td", null, [
                                  _ctx.can("stock.replenish") ? (_openBlock(), _createElementBlock("button", {
                                    key: 0,
                                    class: "row-link",
                                    onClick: ($event) => _ctx.sku = row.sku.skuId
                                  }, "补货", 8, ["onClick"])) : _createCommentVNode("v-if", true)
                                ])
                              ],
                              2
                              /* CLASS */
                            );
                          }),
                          128
                          /* KEYED_FRAGMENT */
                        ))
                      ])
                    ])
                  ])
                ]),
                _createElementVNode("section", { class: "ops-card ops-sideform" }, [
                  _ctx.can("stock.replenish") ? (_openBlock(), _createElementBlock(
                    _Fragment,
                    { key: 0 },
                    [
                      _createElementVNode("h2", null, "库存补货"),
                      _createElementVNode("form", {
                        onSubmit: _withModifiers(_ctx.replenish, ["prevent"])
                      }, [
                        _createElementVNode("label", {
                          class: "field-label",
                          for: "merchantops-field-1"
                        }, "SKU"),
                        _withDirectives(_createElementVNode("select", {
                          id: "merchantops-field-1",
                          class: "admin-input",
                          "onUpdate:modelValue": ($event) => _ctx.sku = $event,
                          required: ""
                        }, [
                          _createElementVNode("option", {
                            disabled: "",
                            value: ""
                          }, "选择规格"),
                          (_openBlock(true), _createElementBlock(
                            _Fragment,
                            null,
                            _renderList(_ctx.skuRows, (row) => {
                              return _openBlock(), _createElementBlock("option", {
                                key: row.sku.skuId,
                                value: row.sku.skuId
                              }, _toDisplayString(row.product.title) + " · " + _toDisplayString(row.sku.specKey), 9, ["value"]);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ], 8, ["onUpdate:modelValue"]), [
                          [_vModelSelect, _ctx.sku]
                        ]),
                        _createElementVNode("label", {
                          class: "field-label",
                          for: "merchantops-field-2"
                        }, "补货数量"),
                        _withDirectives(_createElementVNode("input", {
                          id: "merchantops-field-2",
                          type: "number",
                          class: "admin-input",
                          "onUpdate:modelValue": ($event) => _ctx.amount = $event,
                          min: "1",
                          max: "1000000",
                          required: ""
                        }, null, 8, ["onUpdate:modelValue"]), [
                          [
                            _vModelText,
                            _ctx.amount,
                            void 0,
                            { number: true }
                          ]
                        ]),
                        _createElementVNode("button", {
                          class: "teal-button",
                          type: "submit",
                          disabled: !_ctx.canAct
                        }, "确认补货", 8, ["disabled"])
                      ], 40, ["onSubmit"])
                    ],
                    64
                    /* STABLE_FRAGMENT */
                  )) : _createCommentVNode("v-if", true),
                  _createElementVNode("div", { class: "ops-card-header compact" }, [
                    _createElementVNode("h3", null, "库存流水"),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.movementPageInfo.total || 0) + " 条",
                      1
                      /* TEXT */
                    )
                  ]),
                  _createElementVNode("label", { class: "ops-search" }, [
                    _createVNode2(_component_Icon, {
                      name: "search",
                      size: 17
                    }),
                    _withDirectives(_createElementVNode("input", {
                      "onUpdate:modelValue": ($event) => _ctx.movementQ = $event,
                      placeholder: "单据号 / SKU"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.movementQ]
                    ])
                  ]),
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(_ctx.moves, (m) => {
                      return _openBlock(), _createElementBlock("div", {
                        class: "ops-list-line",
                        key: m.id
                      }, [
                        _createElementVNode("span", { class: "mini-icon" }, [
                          _createVNode2(_component_Icon, {
                            name: "box",
                            size: 16
                          })
                        ]),
                        _createElementVNode("div", null, [
                          _createElementVNode(
                            "strong",
                            null,
                            _toDisplayString(_ctx.inventoryOperationLabel(m.type)),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "small",
                            null,
                            _toDisplayString(_ctx.dateTime(m.createdAt)) + " · 单据 " + _toDisplayString(m.bizKey),
                            1
                            /* TEXT */
                          )
                        ]),
                        _createElementVNode(
                          "b",
                          null,
                          _toDisplayString(_ctx.inventoryQuantityLabel(m)),
                          1
                          /* TEXT */
                        )
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  !_ctx.moves.length ? (_openBlock(), _createElementBlock("div", {
                    key: 1,
                    class: "admin-empty"
                  }, "暂无匹配流水")) : _createCommentVNode("v-if", true),
                  _ctx.movementPageInfo.total > 0 ? (_openBlock(), _createElementBlock("div", {
                    key: 2,
                    class: "sdd-pager"
                  }, [
                    _createElementVNode("button", {
                      disabled: _ctx.movementPage <= 1,
                      onClick: ($event) => _ctx.movementPage--
                    }, "上一页", 8, ["disabled", "onClick"]),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.movementPage),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("button", {
                      disabled: !_ctx.movementPageInfo.hasNext,
                      onClick: ($event) => _ctx.movementPage++
                    }, "下一页", 8, ["disabled", "onClick"])
                  ])) : _createCommentVNode("v-if", true)
                ])
              ])) : _ctx.route === "/merchant/orders" || _ctx.route === "/merchant/pickup" ? (_openBlock(), _createElementBlock("div", {
                key: 5,
                class: "ops-card"
              }, [
                _createElementVNode("div", { class: "ops-card-header" }, [
                  _createElementVNode("div", null, [
                    _createElementVNode(
                      "h2",
                      null,
                      _toDisplayString(_ctx.route === "/merchant/pickup" ? "交付核销" : "订单列表"),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("small", null, "待办筛选由服务端按履约任务状态计算")
                  ]),
                  _createElementVNode("div", { class: "filter-pills" }, [
                    _createElementVNode("button", {
                      class: _normalizeClass({ active: _ctx.pickupState === "" }),
                      onClick: ($event) => _ctx.pickupState = ""
                    }, "全部", 10, ["onClick"]),
                    _createElementVNode("button", {
                      class: _normalizeClass({ active: _ctx.pickupState === "WAIT_PREP" }),
                      onClick: ($event) => _ctx.pickupState = "WAIT_PREP"
                    }, "待备货", 10, ["onClick"]),
                    _createElementVNode("button", {
                      class: _normalizeClass({ active: _ctx.pickupState === "PREPARING" }),
                      onClick: ($event) => _ctx.pickupState = "PREPARING"
                    }, "备货中", 10, ["onClick"]),
                    _createElementVNode("button", {
                      class: _normalizeClass({ active: _ctx.pickupState === "READY" }),
                      onClick: ($event) => _ctx.pickupState = "READY"
                    }, "待核销", 10, ["onClick"]),
                    _createElementVNode("button", {
                      class: _normalizeClass({ active: _ctx.pickupState === "COMPLETED" }),
                      onClick: ($event) => _ctx.pickupState = "COMPLETED"
                    }, "已核销", 10, ["onClick"])
                  ])
                ]),
                _createElementVNode("div", { class: "filter-pills secondary-pills" }, [
                  _createElementVNode("button", {
                    class: _normalizeClass({ active: _ctx.filter === "" }),
                    onClick: ($event) => _ctx.filter = ""
                  }, "所有订单状态", 10, ["onClick"]),
                  _createElementVNode("button", {
                    class: _normalizeClass({ active: _ctx.filter === "PAID" }),
                    onClick: ($event) => _ctx.filter = "PAID"
                  }, "已支付", 10, ["onClick"]),
                  _createElementVNode("button", {
                    class: _normalizeClass({ active: _ctx.filter === "COMPLETED" }),
                    onClick: ($event) => _ctx.filter = "COMPLETED"
                  }, "已完成", 10, ["onClick"])
                ]),
                _createElementVNode("label", { class: "ops-search" }, [
                  _createVNode2(_component_Icon, {
                    name: "search",
                    size: 17
                  }),
                  _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": ($event) => _ctx.q = $event,
                    placeholder: "搜索订单号 / 商品"
                  }, null, 8, ["onUpdate:modelValue"]), [
                    [_vModelText, _ctx.q]
                  ])
                ]),
                _createElementVNode("div", { class: "ops-grid orders-split" }, [
                  _createElementVNode("div", { class: "ops-table-wrap" }, [
                    _createElementVNode("table", { class: "ops-table" }, [
                      _createElementVNode("thead", null, [
                        _createElementVNode("tr", null, [
                          _createElementVNode("th", null, "订单"),
                          _createElementVNode("th", null, "商品"),
                          _createElementVNode("th", null, "金额"),
                          _createElementVNode("th", null, "状态"),
                          _createElementVNode("th")
                        ])
                      ]),
                      _createElementVNode("tbody", null, [
                        (_openBlock(true), _createElementBlock(
                          _Fragment,
                          null,
                          _renderList(_ctx.visibleOrders, (o) => {
                            var _a2, _b2, _c2, _d2;
                            return _openBlock(), _createElementBlock("tr", {
                              key: o.orderId,
                              class: _normalizeClass({ active: ((_a2 = _ctx.selectedOrder) == null ? void 0 : _a2.orderId) === o.orderId }),
                              onClick: ($event) => _ctx.picked = o.orderId
                            }, [
                              _createElementVNode("td", null, [
                                _createElementVNode("button", {
                                  class: "row-link",
                                  onClick: _withModifiers(($event) => _ctx.picked = o.orderId, ["stop"]),
                                  "aria-pressed": ((_b2 = _ctx.selectedOrder) == null ? void 0 : _b2.orderId) === o.orderId
                                }, "#" + _toDisplayString(o.orderId), 9, ["onClick", "aria-pressed"]),
                                _createElementVNode(
                                  "small",
                                  null,
                                  _toDisplayString(_ctx.dateTime(o.createdAt)),
                                  1
                                  /* TEXT */
                                )
                              ]),
                              _createElementVNode(
                                "td",
                                null,
                                _toDisplayString(((_d2 = (_c2 = o.items) == null ? void 0 : _c2[0]) == null ? void 0 : _d2.title) || "—"),
                                1
                                /* TEXT */
                              ),
                              _createElementVNode(
                                "td",
                                null,
                                _toDisplayString(_ctx.money(o.totalCent)),
                                1
                                /* TEXT */
                              ),
                              _createElementVNode("td", null, [
                                _createElementVNode(
                                  "span",
                                  {
                                    class: _normalizeClass(["status-tag", o.status === "COMPLETED" ? "published" : "draft"])
                                  },
                                  _toDisplayString(_ctx.orderStatusLabel(o.status)),
                                  3
                                  /* TEXT, CLASS */
                                ),
                                o.pickup ? (_openBlock(), _createElementBlock(
                                  "small",
                                  { key: 0 },
                                  _toDisplayString(_ctx.pickupStatusLabel(o.pickup.status)),
                                  1
                                  /* TEXT */
                                )) : _createCommentVNode("v-if", true),
                                _ctx.orderReminder(o) ? (_openBlock(), _createElementBlock(
                                  "small",
                                  {
                                    key: 1,
                                    class: "red-text"
                                  },
                                  _toDisplayString(_ctx.orderReminder(o)),
                                  1
                                  /* TEXT */
                                )) : _createCommentVNode("v-if", true)
                              ]),
                              _createElementVNode("td", null, [
                                _createVNode2(_component_Icon, {
                                  name: "chevronRight",
                                  size: 16
                                })
                              ])
                            ], 10, ["onClick"]);
                          }),
                          128
                          /* KEYED_FRAGMENT */
                        ))
                      ])
                    ]),
                    !_ctx.visibleOrders.length ? (_openBlock(), _createElementBlock("div", {
                      key: 0,
                      class: "admin-empty"
                    }, "暂无符合条件的订单")) : _createCommentVNode("v-if", true)
                  ]),
                  _ctx.selectedOrder ? (_openBlock(), _createElementBlock("aside", {
                    key: 0,
                    class: "order-inspector"
                  }, [
                    _createElementVNode("h2", null, "订单详情"),
                    _createElementVNode("div", { class: "inspector-row" }, [
                      _createElementVNode("span", null, "订单编号"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.selectedOrder.orderId),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createElementVNode("div", { class: "inspector-row" }, [
                      _createElementVNode("span", null, "订单状态"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.orderStatusLabel(_ctx.selectedOrder.status)),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createElementVNode("div", { class: "inspector-row" }, [
                      _createElementVNode("span", null, "自提进度"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.pickupStatusLabel((_d = _ctx.selectedOrder.pickup) == null ? void 0 : _d.status)),
                        1
                        /* TEXT */
                      )
                    ]),
                    _ctx.orderReminder(_ctx.selectedOrder) ? (_openBlock(), _createElementBlock(
                      "div",
                      {
                        key: 0,
                        class: "inline-error"
                      },
                      _toDisplayString(_ctx.orderReminder(_ctx.selectedOrder)),
                      1
                      /* TEXT */
                    )) : _createCommentVNode("v-if", true),
                    _createElementVNode("div", { class: "inspector-row" }, [
                      _createElementVNode("span", null, "金额"),
                      _createElementVNode(
                        "b",
                        { class: "red-text" },
                        _toDisplayString(_ctx.money(_ctx.selectedOrder.totalCent)),
                        1
                        /* TEXT */
                      )
                    ]),
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.selectedOrder.items, (i) => {
                        return _openBlock(), _createElementBlock("div", {
                          class: "order-detail-line",
                          key: i.skuId
                        }, [
                          _createElementVNode("span", { class: "mini-icon" }, [
                            _createVNode2(_component_Icon, { name: "package" })
                          ]),
                          _createElementVNode("div", null, [
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(i.title),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode(
                              "small",
                              null,
                              _toDisplayString(i.specKey) + " × " + _toDisplayString(i.quantity),
                              1
                              /* TEXT */
                            )
                          ])
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    )),
                    _createElementVNode("div", { class: "form-buttons" }, [
                      _ctx.can("order.prepare") && _ctx.selectedOrder.status === "PAID" && ((_e = _ctx.selectedOrder.pickup) == null ? void 0 : _e.status) === "WAIT_PREP" ? (_openBlock(), _createElementBlock("button", {
                        key: 0,
                        class: "outline-button",
                        disabled: !_ctx.canAct,
                        onClick: ($event) => _ctx.prepare(_ctx.selectedOrder, false)
                      }, "开始备货", 8, ["disabled", "onClick"])) : _createCommentVNode("v-if", true),
                      _ctx.can("order.prepare") && _ctx.selectedOrder.status === "PAID" && ((_f = _ctx.selectedOrder.pickup) == null ? void 0 : _f.status) === "PREPARING" ? (_openBlock(), _createElementBlock("button", {
                        key: 1,
                        class: "teal-button",
                        disabled: !_ctx.canAct,
                        onClick: ($event) => _ctx.prepare(_ctx.selectedOrder, true)
                      }, "备货完成", 8, ["disabled", "onClick"])) : _createCommentVNode("v-if", true)
                    ]),
                    _ctx.can("pickup.verify") && _ctx.selectedOrder.status === "PAID" && ((_g = _ctx.selectedOrder.pickup) == null ? void 0 : _g.status) === "READY" ? (_openBlock(), _createElementBlock("form", {
                      key: 1,
                      class: "verify-form",
                      onSubmit: _withModifiers(($event) => _ctx.verify(_ctx.selectedOrder), ["prevent"])
                    }, [
                      _createElementVNode("label", {
                        class: "field-label",
                        for: "merchantops-field-3"
                      }, "买家自提令牌"),
                      _withDirectives(_createElementVNode("textarea", {
                        id: "merchantops-field-3",
                        class: "admin-input",
                        "onUpdate:modelValue": ($event) => _ctx.token = $event,
                        rows: "3",
                        required: "",
                        placeholder: "输入买家自提令牌"
                      }, null, 8, ["onUpdate:modelValue"]), [
                        [_vModelText, _ctx.token]
                      ]),
                      _createElementVNode("button", {
                        type: "submit",
                        class: "teal-button",
                        disabled: !_ctx.canAct
                      }, "核销自提", 8, ["disabled"])
                    ], 40, ["onSubmit"])) : _createCommentVNode("v-if", true)
                  ])) : _createCommentVNode("v-if", true)
                ])
              ])) : _ctx.route === "/merchant/aftersales" ? (_openBlock(), _createElementBlock("section", {
                key: 6,
                class: "ops-card"
              }, [
                _createElementVNode("div", { class: "ops-card-header" }, [
                  _createElementVNode("h2", null, "售后申请"),
                  _createElementVNode(
                    "span",
                    null,
                    _toDisplayString(_ctx.preview ? _ctx.afterSales.length : _ctx.pageInfo.total) + " 条",
                    1
                    /* TEXT */
                  )
                ]),
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.afterSales, (s) => {
                    return _openBlock(), _createElementBlock("div", {
                      class: "ops-list-line",
                      key: s.id
                    }, [
                      _createElementVNode("span", { class: "mini-icon" }, [
                        _createVNode2(_component_Icon, { name: "shield" })
                      ]),
                      _createElementVNode("div", null, [
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(s.orderId),
                          1
                          /* TEXT */
                        ),
                        _createElementVNode(
                          "small",
                          null,
                          _toDisplayString(s.reason),
                          1
                          /* TEXT */
                        )
                      ]),
                      _createElementVNode(
                        "span",
                        { class: "status-tag" },
                        _toDisplayString(_ctx.afterSaleStatusLabel(s.status)),
                        1
                        /* TEXT */
                      ),
                      _ctx.can("aftersale.read") ? (_openBlock(), _createElementBlock("button", {
                        key: 0,
                        class: "outline-button small",
                        onClick: ($event) => _ctx.openAfterSaleDecision(s.orderId)
                      }, _toDisplayString(s.status === "REQUESTED" ? "审核" : "查看历程"), 9, ["onClick"])) : _createCommentVNode("v-if", true)
                    ]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                )),
                !_ctx.afterSales.length ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "admin-empty"
                }, "暂无售后")) : _createCommentVNode("v-if", true),
                _ctx.decision && _ctx.can("aftersale.read") && _ctx.afterSales.find((s) => s.orderId === _ctx.decision) ? (_openBlock(), _createElementBlock("section", {
                  key: 1,
                  class: "review-inline"
                }, [
                  _createElementVNode(
                    "h3",
                    null,
                    "售后处理 · " + _toDisplayString(_ctx.decision),
                    1
                    /* TEXT */
                  ),
                  _createElementVNode("div", { class: "review-history" }, [
                    _createElementVNode("strong", null, "处理历程"),
                    _ctx.historyEvents.length ? (_openBlock(), _createElementBlock("ol", { key: 0 }, [
                      (_openBlock(true), _createElementBlock(
                        _Fragment,
                        null,
                        _renderList(_ctx.historyEvents, (e, i) => {
                          return _openBlock(), _createElementBlock("li", {
                            key: e.eventId || i
                          }, [
                            _createElementVNode(
                              "b",
                              null,
                              _toDisplayString(_ctx.orderEventLabel(e.type)),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode("small", null, [
                              _createTextVNode(
                                _toDisplayString(_ctx.dateTime(e.occurredAt)),
                                1
                                /* TEXT */
                              ),
                              e.reason ? (_openBlock(), _createElementBlock(
                                _Fragment,
                                { key: 0 },
                                [
                                  _createTextVNode(
                                    " · " + _toDisplayString(e.reason),
                                    1
                                    /* TEXT */
                                  )
                                ],
                                64
                                /* STABLE_FRAGMENT */
                              )) : _createCommentVNode("v-if", true)
                            ])
                          ]);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      ))
                    ])) : _ctx.historyLoading ? (_openBlock(), _createElementBlock("p", {
                      key: 1,
                      class: "muted-short"
                    }, "正在加载处理历程…")) : (_openBlock(), _createElementBlock(
                      "p",
                      {
                        key: 2,
                        class: "muted-short"
                      },
                      _toDisplayString(_ctx.historyError || "历史记录不完整，仅显示当前状态"),
                      1
                      /* TEXT */
                    ))
                  ]),
                  ((_h = _ctx.afterSales.find((s) => s.orderId === _ctx.decision)) == null ? void 0 : _h.status) === "REQUESTED" ? (_openBlock(), _createElementBlock("form", {
                    key: 0,
                    onSubmit: _withModifiers(($event) => _ctx.decisionAction(_ctx.afterSales.find((s) => s.orderId === _ctx.decision), true), ["prevent"])
                  }, [
                    _withDirectives(_createElementVNode("textarea", {
                      class: "admin-input",
                      rows: "3",
                      "onUpdate:modelValue": ($event) => _ctx.reason = $event,
                      maxlength: "500",
                      required: "",
                      placeholder: "审核说明（必填）"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.reason]
                    ]),
                    _createElementVNode("div", { class: "form-buttons" }, [
                      _createElementVNode("button", {
                        type: "button",
                        class: "outline-button",
                        disabled: !_ctx.canAct || !_ctx.reason.trim(),
                        onClick: ($event) => _ctx.decisionAction(_ctx.afterSales.find((s) => s.orderId === _ctx.decision), false)
                      }, "驳回", 8, ["disabled", "onClick"]),
                      _createElementVNode("button", {
                        type: "submit",
                        class: "teal-button",
                        disabled: !_ctx.canAct || !_ctx.reason.trim()
                      }, "同意退款", 8, ["disabled"])
                    ])
                  ], 40, ["onSubmit"])) : _createCommentVNode("v-if", true)
                ])) : _createCommentVNode("v-if", true)
              ])) : _ctx.route === "/merchant/team" ? (_openBlock(), _createElementBlock("div", {
                key: 7,
                class: "ops-grid"
              }, [
                _createElementVNode("section", { class: "ops-card" }, [
                  _createElementVNode("div", { class: "ops-card-header" }, [
                    _createElementVNode("h2", null, "成员"),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.members.length) + " 人",
                      1
                      /* TEXT */
                    )
                  ]),
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(_ctx.members, (m) => {
                      var _a2;
                      return _openBlock(), _createElementBlock("div", {
                        class: "ops-list-line",
                        key: m.userId
                      }, [
                        _createElementVNode("span", { class: "mini-icon" }, [
                          _createVNode2(_component_Icon, { name: "user" })
                        ]),
                        _createElementVNode("div", null, [
                          _createElementVNode(
                            "strong",
                            null,
                            _toDisplayString(m.userId),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "small",
                            null,
                            _toDisplayString(((_a2 = _ctx.roles.find((r) => r.code === m.role)) == null ? void 0 : _a2.name) || m.role) + " · " + _toDisplayString(_ctx.membershipStatusLabel(m.status)),
                            1
                            /* TEXT */
                          )
                        ]),
                        m.role !== "OWNER" && m.status === "ACTIVE" ? (_openBlock(), _createElementBlock("select", {
                          key: 0,
                          class: "admin-input compact-select",
                          value: m.role,
                          disabled: !_ctx.canAct || !_ctx.canOwner,
                          onChange: ($event) => _ctx.assignMember(m, $event)
                        }, [
                          (_openBlock(true), _createElementBlock(
                            _Fragment,
                            null,
                            _renderList(_ctx.roles.filter((r) => r.code !== "OWNER"), (r) => {
                              return _openBlock(), _createElementBlock("option", {
                                value: r.code,
                                key: r.code
                              }, _toDisplayString(r.name), 9, ["value"]);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ], 40, ["value", "disabled", "onChange"])) : _createCommentVNode("v-if", true),
                        m.role !== "OWNER" && m.status === "ACTIVE" ? (_openBlock(), _createElementBlock("button", {
                          key: 1,
                          class: "outline-button small",
                          disabled: !_ctx.canAct || !_ctx.canOwner,
                          onClick: ($event) => _ctx.revoke(m)
                        }, "撤销", 8, ["disabled", "onClick"])) : _createCommentVNode("v-if", true)
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ]),
                _createElementVNode("section", { class: "ops-card ops-sideform" }, [
                  _createElementVNode("h2", null, "邀请店员"),
                  _createElementVNode("form", {
                    onSubmit: _withModifiers(_ctx.invite, ["prevent"])
                  }, [
                    _createElementVNode("label", {
                      class: "field-label",
                      for: "merchantops-field-4"
                    }, "已注册用户名"),
                    _withDirectives(_createElementVNode("input", {
                      id: "merchantops-field-4",
                      class: "admin-input",
                      "onUpdate:modelValue": ($event) => _ctx.inviteUser = $event,
                      required: "",
                      maxlength: "32",
                      placeholder: "用户名"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.inviteUser]
                    ]),
                    _createElementVNode("button", {
                      type: "submit",
                      class: "teal-button",
                      disabled: !_ctx.canAct || !_ctx.canOwner
                    }, "发送邀请", 8, ["disabled"])
                  ], 40, ["onSubmit"]),
                  _createElementVNode("button", {
                    class: "outline-button small",
                    onClick: ($event) => _ctx.go("/merchant/roles")
                  }, "管理角色和权限", 8, ["onClick"])
                ])
              ])) : _ctx.route === "/merchant/settings" ? (_openBlock(), _createElementBlock("section", {
                key: 8,
                class: "ops-card ops-settings"
              }, [
                _createElementVNode("h2", null, "门店资料"),
                _createElementVNode("form", {
                  onSubmit: _withModifiers(_ctx.saveProfile, ["prevent"])
                }, [
                  _createElementVNode("label", null, [
                    _createTextVNode("经营名称"),
                    _withDirectives(_createElementVNode("input", {
                      class: "admin-input",
                      "onUpdate:modelValue": ($event) => _ctx.profile.name = $event,
                      required: "",
                      maxlength: "100"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.profile.name]
                    ])
                  ]),
                  _createElementVNode("label", null, [
                    _createTextVNode("门店名称"),
                    _withDirectives(_createElementVNode("input", {
                      class: "admin-input",
                      "onUpdate:modelValue": ($event) => _ctx.profile.storeName = $event,
                      required: "",
                      maxlength: "100"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.profile.storeName]
                    ])
                  ]),
                  _createElementVNode("label", null, [
                    _createTextVNode("自提位置"),
                    _withDirectives(_createElementVNode("input", {
                      class: "admin-input",
                      "onUpdate:modelValue": ($event) => _ctx.profile.location = $event,
                      required: "",
                      maxlength: "200"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.profile.location]
                    ])
                  ]),
                  _createElementVNode("label", null, [
                    _createTextVNode("门店介绍"),
                    _withDirectives(_createElementVNode("textarea", {
                      class: "admin-input",
                      "onUpdate:modelValue": ($event) => _ctx.profile.description = $event,
                      maxlength: "2000",
                      rows: "4",
                      placeholder: "未填写"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.profile.description]
                    ])
                  ]),
                  _createElementVNode("label", null, [
                    _createTextVNode("营业时间"),
                    _withDirectives(_createElementVNode("input", {
                      class: "admin-input",
                      "onUpdate:modelValue": ($event) => _ctx.profile.businessHours = $event,
                      maxlength: "200",
                      placeholder: "如：周一至周五 08:00-20:00（北京时间）"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.profile.businessHours]
                    ])
                  ]),
                  _createElementVNode("div", { class: "store-image-field" }, [
                    _createElementVNode("span", null, "门店图片"),
                    _createVNode2(_component_ProductImage, {
                      src: _ctx.profile.imageUrl,
                      alt: "门店图片"
                    }, null, 8, ["src"]),
                    _createElementVNode("input", {
                      type: "file",
                      accept: "image/png,image/jpeg,image/webp",
                      onChange: _ctx.uploadStoreImage,
                      disabled: !_ctx.canAct || !_ctx.canOwner || _ctx.busy
                    }, null, 40, ["onChange", "disabled"]),
                    _createElementVNode("small", null, "只接受本商户上传的门店图片，未上传时显示未填写"),
                    _ctx.profile.imageUrl ? (_openBlock(), _createElementBlock("button", {
                      key: 0,
                      type: "button",
                      class: "outline-button",
                      onClick: ($event) => _ctx.profile.imageUrl = ""
                    }, "移除图片", 8, ["onClick"])) : _createCommentVNode("v-if", true)
                  ]),
                  _createElementVNode("button", {
                    class: "teal-button",
                    disabled: !_ctx.canAct || !_ctx.canOwner || _ctx.busy,
                    type: "submit"
                  }, "保存设置", 8, ["disabled"])
                ], 40, ["onSubmit"])
              ])) : _createCommentVNode("v-if", true),
              !_ctx.preview && ["/merchant/orders", "/merchant/pickup", "/merchant/aftersales", "/merchant/inventory"].includes(_ctx.route) && _ctx.pageInfo.total > 0 ? (_openBlock(), _createElementBlock("div", {
                key: 9,
                class: "sdd-pager"
              }, [
                _createElementVNode(
                  "span",
                  null,
                  "共 " + _toDisplayString(_ctx.pageInfo.total) + " 条",
                  1
                  /* TEXT */
                ),
                _createElementVNode("button", {
                  disabled: _ctx.page <= 1,
                  onClick: ($event) => _ctx.page--
                }, "上一页", 8, ["disabled", "onClick"]),
                _createElementVNode(
                  "span",
                  null,
                  _toDisplayString(_ctx.page),
                  1
                  /* TEXT */
                ),
                _createElementVNode("button", {
                  disabled: !_ctx.pageInfo.hasNext,
                  onClick: ($event) => _ctx.page++
                }, "下一页", 8, ["disabled", "onClick"])
              ])) : _createCommentVNode("v-if", true)
            ];
          }),
          _: 1
          /* STABLE */
        }, 8, ["title"]);
      };
    })()
  };
  const { ref: ref$3, computed: computed$3, onMounted: onMounted$2, onUnmounted: onUnmounted$2, watch: watch$2 } = Vue;
  const Knowledge = {
    name: "Knowledge",
    components: { BackofficeShell },
    setup() {
      const scope = requestScope();
      const docScope = requestScope();
      const contentScope = requestScope();
      const role = computed$3(() => store.route.startsWith("/admin") ? "admin" : "merchant");
      const bases = ref$3([]), docs = ref$3([]), active = ref$3(""), selected = ref$3(null), text = ref$3("");
      const error = ref$3(""), busy = ref$3(false), newBase = ref$3(false), uploading = ref$3(false), baseName = ref$3(""), visibility = ref$3("PUBLIC"), title = ref$3(""), file = ref$3(null);
      const docPage = ref$3(1), docInfo = ref$3({ total: 0, hasNext: false });
      const versionRoot = ref$3(null), versionBase = ref$3(""), fileVersion = ref$3(0);
      function clearUpload() {
        versionRoot.value = null;
        versionBase.value = "";
        title.value = "";
        file.value = null;
        uploading.value = false;
        ++fileVersion.value;
      }
      watch$2(active, clearUpload);
      const current = computed$3(() => bases.value.find((b) => b.id === active.value));
      let baseEpoch2 = 0, docEpoch = 0, readEpoch = 0;
      const canRead = computed$3(
        () => {
          var _a;
          return preview || (role.value === "admin" ? ((_a = store.workspace) == null ? void 0 : _a.platformAdmin) === true : hasPermission("knowledge.read"));
        }
      );
      const canManage = computed$3(
        () => {
          var _a;
          return preview || (role.value === "admin" ? ((_a = store.workspace) == null ? void 0 : _a.platformAdmin) === true : hasPermission("knowledge.manage"));
        }
      );
      const context = (targetRole, targetMid) => targetRole === role.value && targetMid === store.merchantId;
      let refreshingBases = false;
      async function load() {
        var _a, _b;
        const request2 = scope.begin();
        const valid = request2.current;
        const stamp = ++baseEpoch2, currentRole = role.value, mid = store.merchantId;
        ++docEpoch;
        ++readEpoch;
        error.value = "";
        bases.value = [];
        docs.value = [];
        selected.value = null;
        text.value = "";
        if (currentRole === "admin" && !preview && !((_a = store.workspace) == null ? void 0 : _a.platformAdmin)) {
          try {
            const [user, workspace] = await Promise.all([api("/auth/me"), api("/workspace")]);
            if (!valid() || stamp !== baseEpoch2 || !context(currentRole, mid)) return;
            store.user = user;
            store.workspace = workspace;
          } catch (e) {
            if (stamp === baseEpoch2) error.value = e.message;
            return;
          }
        }
        if (!canRead.value) {
          active.value = "";
          return;
        }
        try {
          const result = preview ? DEMO_BASES : await api("/knowledge/bases", { signal: request2.signal });
          if (!valid() || stamp !== baseEpoch2 || !context(currentRole, mid)) return;
          bases.value = (result || []).filter(
            (b) => currentRole === "admin" ? b.merchantId == null : b.merchantId === mid
          );
          if (!bases.value.some((b) => b.id === active.value))
            active.value = ((_b = bases.value[0]) == null ? void 0 : _b.id) || "";
          refreshingBases = true;
          docPage.value = 1;
          refreshingBases = false;
          await loadDocs();
        } catch (e) {
          if (stamp === baseEpoch2 && context(currentRole, mid)) error.value = e.message;
        }
      }
      async function loadDocs() {
        const request2 = docScope.begin();
        const stamp = ++docEpoch, id = active.value, page = docPage.value, currentRole = role.value, mid = store.merchantId;
        ++readEpoch;
        selected.value = null;
        text.value = "";
        docs.value = [];
        if (!id) {
          docInfo.value = { total: 0, hasNext: false };
          return;
        }
        const valid = () => request2.current() && stamp === docEpoch && active.value === id && docPage.value === page && context(currentRole, mid);
        try {
          const result = preview ? {
            items: DEMO_DOCS.filter((d) => d.baseId === id),
            total: DEMO_DOCS.filter((d) => d.baseId === id).length,
            hasNext: false
          } : await api(
            "/knowledge/bases/" + pathId(id) + "/documents/page" + query({ page, size: 15 }),
            { signal: request2.signal }
          );
          if (!valid()) return;
          docs.value = result.items || [];
          docInfo.value = result;
        } catch (e) {
          if (valid()) error.value = e.message;
        }
      }
      onMounted$2(load);
      onUnmounted$2(() => {
        ++baseEpoch2;
        ++docEpoch;
        ++readEpoch;
      });
      watch$2(
        docPage,
        () => {
          if (!refreshingBases) loadDocs();
        },
        { flush: "sync" }
      );
      function selectBase(id) {
        active.value = id;
        refreshingBases = true;
        docPage.value = 1;
        refreshingBases = false;
        loadDocs();
      }
      async function read(d) {
        var _a;
        const request2 = contentScope.begin();
        const valid = request2.current;
        const stamp = ++readEpoch, id = active.value, mid = store.merchantId, currentRole = role.value;
        selected.value = d;
        text.value = "";
        if (preview) {
          text.value = d.content || "演示文档内容";
          return;
        }
        try {
          const result = await api("/knowledge/documents/" + pathId(d.id), {
            signal: request2.signal
          });
          if (stamp === readEpoch && active.value === id && ((_a = selected.value) == null ? void 0 : _a.id) === d.id && context(currentRole, mid)) {
            text.value = result.content || "";
            selected.value = result;
          }
        } catch (e) {
          if (valid() && stamp === readEpoch) notify(e.message);
        }
      }
      async function create() {
        if (preview || busy.value || !canManage.value || !baseName.value.trim()) return;
        const valid = scope.capture();
        active.value;
        busy.value = true;
        try {
          await api("/knowledge/bases", {
            method: "POST",
            body: {
              merchantId: role.value === "admin" ? null : store.merchantId,
              name: baseName.value.trim(),
              visibility: visibility.value
            }
          });
          if (!valid()) return;
          newBase.value = false;
          baseName.value = "";
          await load();
          notify("已创建知识库");
        } catch (e) {
          if (valid()) notify(e.message);
        } finally {
          if (valid()) busy.value = false;
        }
      }
      function chooseFile(e) {
        var _a;
        const selectedFile = (_a = e.target.files) == null ? void 0 : _a[0];
        file.value = null;
        if (!selectedFile) return;
        if (selectedFile.size === 0 || selectedFile.size > 2e6) {
          notify("文件须为1~2,000,000字节");
          e.target.value = "";
          return;
        }
        if (selectedFile.name.length > 120) {
          notify("文件名不能超过120字符");
          e.target.value = "";
          return;
        }
        if (!/\.(txt|md|pdf)$/i.test(selectedFile.name)) {
          notify("仅支持 TXT、Markdown、文本 PDF");
          e.target.value = "";
          return;
        }
        file.value = selectedFile;
        title.value = title.value || selectedFile.name;
      }
      async function toBase64(f) {
        return new Promise((resolve2, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve2(String(reader.result).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });
      }
      async function upload() {
        if (preview || busy.value || !canManage.value || !active.value || !file.value) return;
        const valid = scope.capture(), base = active.value;
        busy.value = true;
        try {
          const selectedFile = file.value, root = versionRoot.value, documentTitle = title.value.trim() || selectedFile.name;
          if (root && (versionBase.value !== base || !docs.value.some((d) => d.rootId === root && d.baseId === base)))
            throw Error("版本所属知识库已变化，请重新选择文档");
          if (documentTitle.length > 120 || selectedFile.name.length > 120)
            throw Error("标题和文件名不能超过120字符");
          const base64 = await toBase64(selectedFile);
          if (!valid() || active.value !== base) return;
          await api("/knowledge/bases/" + pathId(base) + "/documents", {
            method: "POST",
            body: {
              rootId: root,
              title: documentTitle,
              filename: selectedFile.name,
              contentType: selectedFile.type || (selectedFile.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "text/plain"),
              base64
            }
          });
          if (!valid() || active.value !== base) return;
          uploading.value = false;
          ++fileVersion.value;
          file.value = null;
          title.value = "";
          versionRoot.value = null;
          await loadDocs();
          notify("文档已上传");
        } catch (e) {
          if (valid()) notify(e.message);
        } finally {
          if (valid()) busy.value = false;
        }
      }
      function newVersion(d) {
        if (busy.value || d.baseId !== active.value) return;
        versionBase.value = active.value;
        versionRoot.value = d.rootId;
        title.value = d.title;
        file.value = null;
        uploading.value = true;
      }
      function newDocument() {
        if (busy.value) return;
        versionBase.value = "";
        versionRoot.value = null;
        file.value = null;
        ++fileVersion.value;
        title.value = "";
        uploading.value = !uploading.value;
      }
      async function action(d, operation) {
        if (preview || busy.value || !canManage.value) return;
        const valid = scope.capture(), base = active.value;
        busy.value = true;
        try {
          await api("/knowledge/documents/" + pathId(d.id) + "/" + operation, { method: "POST" });
          if (!valid() || active.value !== base) return;
          await loadDocs();
          notify("操作成功");
        } catch (e) {
          if (valid()) notify(e.message);
        } finally {
          if (valid()) busy.value = false;
        }
      }
      return {
        role,
        canRead,
        canManage,
        bases,
        docs,
        active,
        selected,
        text,
        error,
        busy,
        newBase,
        uploading,
        baseName,
        visibility,
        title,
        file,
        current,
        preview,
        knowledgeIndexStatusLabel,
        knowledgeStatusLabel,
        knowledgeVisibilityLabel,
        dateTime,
        read,
        load,
        loadDocs,
        selectBase,
        docPage,
        docInfo,
        create,
        chooseFile,
        upload,
        action,
        newVersion,
        newDocument,
        versionRoot,
        fileVersion
      };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode2, createTextVNode: _createTextVNode, createElementVNode: _createElementVNode, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, toDisplayString: _toDisplayString, vModelText: _vModelText, withDirectives: _withDirectives, vModelSelect: _vModelSelect, withModifiers: _withModifiers, renderList: _renderList, Fragment: _Fragment, normalizeClass: _normalizeClass, withCtx: _withCtx, createBlock: _createBlock } = Vue;
      return function render2(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_BackofficeShell = _resolveComponent("BackofficeShell");
        return _openBlock(), _createBlock(_component_BackofficeShell, {
          role: _ctx.role,
          title: "知识库"
        }, {
          actions: _withCtx(() => [
            _ctx.canManage ? (_openBlock(), _createElementBlock("div", {
              key: 0,
              class: "head-actions"
            }, [
              _createElementVNode("button", {
                class: "outline-button small",
                onClick: ($event) => _ctx.newBase = !_ctx.newBase,
                disabled: !_ctx.canManage
              }, [
                _createVNode2(_component_Icon, {
                  name: "plus",
                  size: 16
                }),
                _createTextVNode("新建知识库")
              ], 8, ["onClick", "disabled"]),
              _createElementVNode("button", {
                class: "teal-button",
                onClick: _ctx.newDocument,
                disabled: !_ctx.canManage || !_ctx.active
              }, [
                _createVNode2(_component_Icon, {
                  name: "plus",
                  size: 17
                }),
                _createTextVNode("上传文档")
              ], 8, ["onClick", "disabled"])
            ])) : _createCommentVNode("v-if", true)
          ]),
          default: _withCtx(() => {
            var _a;
            return [
              _ctx.error ? (_openBlock(), _createElementBlock(
                "div",
                {
                  key: 0,
                  class: "inline-error"
                },
                _toDisplayString(_ctx.error),
                1
                /* TEXT */
              )) : _createCommentVNode("v-if", true),
              _ctx.canManage && (_ctx.newBase || _ctx.uploading) ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "ops-grid kb-forms"
              }, [
                _ctx.newBase ? (_openBlock(), _createElementBlock("form", {
                  key: 0,
                  class: "ops-card ops-sideform",
                  onSubmit: _withModifiers(_ctx.create, ["prevent"])
                }, [
                  _createElementVNode("h2", null, "新建知识库"),
                  _createElementVNode("label", {
                    class: "field-label",
                    for: "knowledge-field-1"
                  }, "名称"),
                  _withDirectives(_createElementVNode("input", {
                    id: "knowledge-field-1",
                    class: "admin-input",
                    "onUpdate:modelValue": ($event) => _ctx.baseName = $event,
                    maxlength: "100",
                    required: ""
                  }, null, 8, ["onUpdate:modelValue"]), [
                    [_vModelText, _ctx.baseName]
                  ]),
                  _createElementVNode("label", {
                    class: "field-label",
                    for: "knowledge-field-2"
                  }, "可见范围"),
                  _withDirectives(_createElementVNode("select", {
                    id: "knowledge-field-2",
                    class: "admin-input",
                    "onUpdate:modelValue": ($event) => _ctx.visibility = $event
                  }, [
                    _createElementVNode("option", { value: "PUBLIC" }, "公开"),
                    _createElementVNode("option", {
                      value: _ctx.role === "admin" ? "PLATFORM_INTERNAL" : "MERCHANT_INTERNAL"
                    }, "内部", 8, ["value"])
                  ], 8, ["onUpdate:modelValue"]), [
                    [_vModelSelect, _ctx.visibility]
                  ]),
                  _createElementVNode("button", {
                    class: "teal-button",
                    type: "submit",
                    disabled: _ctx.busy || _ctx.preview
                  }, "创建", 8, ["disabled"])
                ], 40, ["onSubmit"])) : _createCommentVNode("v-if", true),
                _ctx.uploading ? (_openBlock(), _createElementBlock("form", {
                  key: 1,
                  class: "ops-card ops-sideform",
                  onSubmit: _withModifiers(_ctx.upload, ["prevent"])
                }, [
                  _createElementVNode(
                    "h2",
                    null,
                    _toDisplayString(_ctx.versionRoot ? "上传新版本" : "上传文档"),
                    1
                    /* TEXT */
                  ),
                  _createElementVNode("label", {
                    class: "field-label",
                    for: "knowledge-field-3"
                  }, "文档标题"),
                  _withDirectives(_createElementVNode("input", {
                    id: "knowledge-field-3",
                    class: "admin-input",
                    "onUpdate:modelValue": ($event) => _ctx.title = $event,
                    maxlength: "120",
                    required: ""
                  }, null, 8, ["onUpdate:modelValue"]), [
                    [_vModelText, _ctx.title]
                  ]),
                  _createElementVNode("label", {
                    class: "field-label",
                    for: "knowledge-field-4"
                  }, "TXT / MD / 文本 PDF · 最多2,000,000字节"),
                  (_openBlock(), _createElementBlock("input", {
                    id: "knowledge-field-4",
                    key: _ctx.fileVersion,
                    class: "admin-input",
                    type: "file",
                    accept: ".txt,.md,.pdf",
                    onChange: _ctx.chooseFile,
                    required: ""
                  }, null, 40, ["onChange"])),
                  _createElementVNode("button", {
                    class: "teal-button",
                    type: "submit",
                    disabled: _ctx.busy || _ctx.preview || !_ctx.file
                  }, "上传并索引", 8, ["disabled"])
                ], 40, ["onSubmit"])) : _createCommentVNode("v-if", true)
              ])) : _createCommentVNode("v-if", true),
              !_ctx.canRead ? (_openBlock(), _createElementBlock("div", {
                key: 2,
                class: "ops-card access-denied"
              }, "当前账号没有知识库查看权限。")) : (_openBlock(), _createElementBlock("div", {
                key: 3,
                class: "knowledge-layout"
              }, [
                _createElementVNode("section", { class: "ops-card kb-list" }, [
                  _createElementVNode("div", { class: "ops-card-header" }, [
                    _createElementVNode("h2", null, "知识库"),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.bases.length),
                      1
                      /* TEXT */
                    )
                  ]),
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(_ctx.bases, (b) => {
                      return _openBlock(), _createElementBlock("button", {
                        key: b.id,
                        class: _normalizeClass(["kb-base", { active: _ctx.active === b.id }]),
                        disabled: _ctx.busy,
                        "aria-pressed": _ctx.active === b.id,
                        onClick: ($event) => _ctx.selectBase(b.id)
                      }, [
                        _createElementVNode("span", { class: "mini-icon" }, [
                          _createVNode2(_component_Icon, { name: "book" })
                        ]),
                        _createElementVNode("div", null, [
                          _createElementVNode(
                            "strong",
                            null,
                            _toDisplayString(b.name),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "small",
                            null,
                            _toDisplayString(_ctx.knowledgeVisibilityLabel(b.visibility)),
                            1
                            /* TEXT */
                          )
                        ]),
                        _createVNode2(_component_Icon, {
                          name: "chevronRight",
                          size: 16
                        })
                      ], 10, ["disabled", "aria-pressed", "onClick"]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  !_ctx.bases.length ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "admin-empty"
                  }, "暂无知识库")) : _createCommentVNode("v-if", true)
                ]),
                _createElementVNode("section", { class: "ops-card kb-docs" }, [
                  _createElementVNode("div", { class: "ops-card-header" }, [
                    _createElementVNode(
                      "h2",
                      null,
                      _toDisplayString(((_a = _ctx.current) == null ? void 0 : _a.name) || "文档"),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.docInfo.total) + " 项",
                      1
                      /* TEXT */
                    )
                  ]),
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(_ctx.docs, (d) => {
                      var _a2;
                      return _openBlock(), _createElementBlock(
                        "div",
                        {
                          class: _normalizeClass(["kb-doc", { active: ((_a2 = _ctx.selected) == null ? void 0 : _a2.id) === d.id }]),
                          key: d.id
                        },
                        [
                          _createElementVNode("button", {
                            onClick: ($event) => _ctx.read(d)
                          }, [
                            _createElementVNode("span", { class: "mini-icon" }, [
                              _createVNode2(_component_Icon, { name: "clipboard" })
                            ]),
                            _createElementVNode("span", null, [
                              _createElementVNode(
                                "strong",
                                null,
                                _toDisplayString(d.title),
                                1
                                /* TEXT */
                              ),
                              _createElementVNode(
                                "small",
                                null,
                                "v" + _toDisplayString(d.version) + " · " + _toDisplayString(_ctx.dateTime(d.createdAt)),
                                1
                                /* TEXT */
                              )
                            ])
                          ], 8, ["onClick"]),
                          _createElementVNode(
                            "span",
                            {
                              class: _normalizeClass(["status-tag", d.status === "PUBLISHED" ? "published" : "draft"])
                            },
                            _toDisplayString(_ctx.knowledgeStatusLabel(d.status)),
                            3
                            /* TEXT, CLASS */
                          ),
                          _ctx.canManage ? (_openBlock(), _createElementBlock("span", {
                            key: 0,
                            class: "kb-doc-actions"
                          }, [
                            _createElementVNode("button", {
                              disabled: _ctx.busy || _ctx.preview,
                              onClick: ($event) => _ctx.newVersion(d),
                              title: "上传新版本",
                              "aria-label": "上传新版本"
                            }, [
                              _createVNode2(_component_Icon, {
                                name: "plus",
                                size: 15
                              })
                            ], 8, ["disabled", "onClick"]),
                            _createElementVNode("button", {
                              disabled: _ctx.busy || _ctx.preview,
                              onClick: ($event) => _ctx.action(d, "index"),
                              title: "重建索引",
                              "aria-label": "重建索引"
                            }, [
                              _createVNode2(_component_Icon, {
                                name: "refresh",
                                size: 15
                              })
                            ], 8, ["disabled", "onClick"]),
                            _createElementVNode("button", {
                              disabled: _ctx.busy || _ctx.preview || d.indexStatus !== "READY" || d.status === "PUBLISHED",
                              onClick: ($event) => _ctx.action(d, "publish"),
                              title: "发布",
                              "aria-label": "发布文档"
                            }, [
                              _createVNode2(_component_Icon, {
                                name: "check",
                                size: 15
                              })
                            ], 8, ["disabled", "onClick"]),
                            _createElementVNode("button", {
                              disabled: _ctx.busy || _ctx.preview || d.status !== "PUBLISHED",
                              onClick: ($event) => _ctx.action(d, "withdraw"),
                              title: "撤回",
                              "aria-label": "撤回文档"
                            }, [
                              _createVNode2(_component_Icon, {
                                name: "x",
                                size: 15
                              })
                            ], 8, ["disabled", "onClick"])
                          ])) : _createCommentVNode("v-if", true)
                        ],
                        2
                        /* CLASS */
                      );
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  !_ctx.docs.length ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "admin-empty"
                  }, "暂无文档")) : _createCommentVNode("v-if", true),
                  !_ctx.preview && _ctx.docInfo.total > 0 ? (_openBlock(), _createElementBlock("div", {
                    key: 1,
                    class: "sdd-pager"
                  }, [
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.docInfo.total) + " 项",
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("button", {
                      disabled: _ctx.docPage <= 1,
                      onClick: ($event) => _ctx.docPage--
                    }, "上一页", 8, ["disabled", "onClick"]),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.docPage),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("button", {
                      disabled: !_ctx.docInfo.hasNext,
                      onClick: ($event) => _ctx.docPage++
                    }, "下一页", 8, ["disabled", "onClick"])
                  ])) : _createCommentVNode("v-if", true)
                ]),
                _createElementVNode("section", { class: "ops-card kb-preview" }, [
                  _createElementVNode("div", { class: "ops-card-header" }, [
                    _createElementVNode("h2", null, "文档预览"),
                    _ctx.selected ? (_openBlock(), _createElementBlock("button", {
                      key: 0,
                      onClick: ($event) => {
                        _ctx.selected = null;
                        _ctx.text = "";
                      },
                      "aria-label": "关闭"
                    }, [
                      _createVNode2(_component_Icon, {
                        name: "x",
                        size: 18
                      })
                    ], 8, ["onClick"])) : _createCommentVNode("v-if", true)
                  ]),
                  _ctx.selected ? (_openBlock(), _createElementBlock(
                    _Fragment,
                    { key: 0 },
                    [
                      _createElementVNode("div", { class: "kb-title" }, [
                        _createVNode2(_component_Icon, {
                          name: "book",
                          size: 22
                        }),
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(_ctx.selected.title),
                          1
                          /* TEXT */
                        )
                      ]),
                      _createElementVNode("div", { class: "inspector-row" }, [
                        _createElementVNode("span", null, "版本"),
                        _createElementVNode(
                          "strong",
                          null,
                          "v" + _toDisplayString(_ctx.selected.version),
                          1
                          /* TEXT */
                        )
                      ]),
                      _createElementVNode("div", { class: "inspector-row" }, [
                        _createElementVNode("span", null, "索引"),
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(_ctx.knowledgeIndexStatusLabel(_ctx.selected.indexStatus)),
                          1
                          /* TEXT */
                        )
                      ]),
                      _createElementVNode("div", { class: "inspector-row" }, [
                        _createElementVNode("span", null, "状态"),
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(_ctx.knowledgeStatusLabel(_ctx.selected.status)),
                          1
                          /* TEXT */
                        )
                      ]),
                      _ctx.selected.error ? (_openBlock(), _createElementBlock(
                        "p",
                        {
                          key: 0,
                          class: "inline-error"
                        },
                        _toDisplayString(_ctx.selected.error),
                        1
                        /* TEXT */
                      )) : _createCommentVNode("v-if", true),
                      _createElementVNode(
                        "pre",
                        { class: "document-preview" },
                        _toDisplayString(_ctx.text || "该版本暂无可显示的正文"),
                        1
                        /* TEXT */
                      )
                    ],
                    64
                    /* STABLE_FRAGMENT */
                  )) : (_openBlock(), _createElementBlock("div", {
                    key: 1,
                    class: "admin-empty"
                  }, "选择文档查看"))
                ])
              ]))
            ];
          }),
          _: 1
          /* STABLE */
        }, 8, ["role"]);
      };
    })()
  };
  const { ref: ref$2, computed: computed$2 } = Vue;
  const KnowledgeDebug = {
    name: "KnowledgeDebug",
    components: { BackofficeShell },
    setup() {
      const question = ref$2(""), preview2 = ref$2(true), busy = ref$2(false), error = ref$2(""), result = ref$2(null);
      const role = computed$2(() => location.hash.startsWith("#/admin") ? "admin" : "merchant");
      async function run() {
        const q = question.value.trim();
        if (!q || q.length > 1e3 || busy.value) return;
        busy.value = true;
        error.value = "";
        try {
          result.value = await api("/ai/debug/retrieval", {
            method: "POST",
            body: { question: q, answerPreview: preview2.value }
          });
        } catch (e) {
          error.value = e.message;
        } finally {
          busy.value = false;
        }
      }
      return { question, preview: preview2, busy, error, result, role, run };
    },
    render: (() => {
      const { createElementVNode: _createElementVNode, vModelText: _vModelText, withDirectives: _withDirectives, vModelCheckbox: _vModelCheckbox, createTextVNode: _createTextVNode, toDisplayString: _toDisplayString, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, renderList: _renderList, Fragment: _Fragment, resolveComponent: _resolveComponent, withCtx: _withCtx, createBlock: _createBlock } = Vue;
      return function render2(_ctx, _cache) {
        const _component_BackofficeShell = _resolveComponent("BackofficeShell");
        return _openBlock(), _createBlock(_component_BackofficeShell, {
          role: _ctx.role,
          title: "RAG 检索调试"
        }, {
          default: _withCtx(() => {
            var _a;
            return [
              _createElementVNode("section", { class: "knowledge-debug-page" }, [
                _createElementVNode("p", { class: "muted" }, "仅返回当前账号可读文档；回答预览和分数用于调试，不代表交易事实或答案正确性。"),
                _withDirectives(_createElementVNode("textarea", {
                  "onUpdate:modelValue": ($event) => _ctx.question = $event,
                  maxlength: "1000",
                  rows: "4",
                  placeholder: "输入要调试的知识问题"
                }, null, 8, ["onUpdate:modelValue"]), [
                  [_vModelText, _ctx.question]
                ]),
                _createElementVNode("label", { class: "check-line" }, [
                  _withDirectives(_createElementVNode("input", {
                    type: "checkbox",
                    "onUpdate:modelValue": ($event) => _ctx.preview = $event
                  }, null, 8, ["onUpdate:modelValue"]), [
                    [_vModelCheckbox, _ctx.preview]
                  ]),
                  _createTextVNode(" 请求回答预览（会显示实际模式）")
                ]),
                _createElementVNode("button", {
                  class: "teal-button",
                  disabled: _ctx.busy || !_ctx.question.trim(),
                  onClick: _ctx.run
                }, _toDisplayString(_ctx.busy ? "检索中…" : "开始检索"), 9, ["disabled", "onClick"]),
                _ctx.error ? (_openBlock(), _createElementBlock(
                  "p",
                  {
                    key: 0,
                    class: "inline-error"
                  },
                  _toDisplayString(_ctx.error),
                  1
                  /* TEXT */
                )) : _createCommentVNode("v-if", true),
                _ctx.result ? (_openBlock(), _createElementBlock("div", {
                  key: 1,
                  class: "knowledge-debug-result"
                }, [
                  _createElementVNode("div", { class: "stat-row" }, [
                    _createElementVNode(
                      "span",
                      null,
                      "查询：" + _toDisplayString(_ctx.result.query),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode(
                      "span",
                      null,
                      "检索模式：" + _toDisplayString(_ctx.result.retrievalMode || "未知"),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode(
                      "span",
                      null,
                      "回答模式：" + _toDisplayString(_ctx.result.answerMode || "未知"),
                      1
                      /* TEXT */
                    )
                  ]),
                  _ctx.result.warning ? (_openBlock(), _createElementBlock(
                    "p",
                    {
                      key: 0,
                      class: "muted"
                    },
                    _toDisplayString(_ctx.result.warning),
                    1
                    /* TEXT */
                  )) : _createCommentVNode("v-if", true),
                  _ctx.result.answerPreview ? (_openBlock(), _createElementBlock(
                    "blockquote",
                    { key: 1 },
                    _toDisplayString(_ctx.result.answerPreview),
                    1
                    /* TEXT */
                  )) : _createCommentVNode("v-if", true),
                  ((_a = _ctx.result.hits) == null ? void 0 : _a.length) ? (_openBlock(), _createElementBlock("table", { key: 2 }, [
                    _createElementVNode("thead", null, [
                      _createElementVNode("tr", null, [
                        _createElementVNode("th", null, "排名"),
                        _createElementVNode("th", null, "文档/版本"),
                        _createElementVNode("th", null, "片段"),
                        _createElementVNode("th", null, "分数"),
                        _createElementVNode("th", null, "类型")
                      ])
                    ]),
                    _createElementVNode("tbody", null, [
                      (_openBlock(true), _createElementBlock(
                        _Fragment,
                        null,
                        _renderList(_ctx.result.hits, (hit) => {
                          return _openBlock(), _createElementBlock("tr", {
                            key: hit.documentId + "-" + hit.rank
                          }, [
                            _createElementVNode(
                              "td",
                              null,
                              _toDisplayString(hit.rank),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode("td", null, [
                              _createTextVNode(
                                _toDisplayString(hit.title),
                                1
                                /* TEXT */
                              ),
                              _createElementVNode("br"),
                              _createElementVNode(
                                "small",
                                null,
                                _toDisplayString(hit.documentId) + " · v" + _toDisplayString(hit.version),
                                1
                                /* TEXT */
                              )
                            ]),
                            _createElementVNode(
                              "td",
                              null,
                              _toDisplayString(hit.snippet),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode(
                              "td",
                              null,
                              _toDisplayString(hit.score),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode(
                              "td",
                              null,
                              _toDisplayString(hit.scoreType),
                              1
                              /* TEXT */
                            )
                          ]);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      ))
                    ])
                  ])) : (_openBlock(), _createElementBlock("p", {
                    key: 3,
                    class: "muted"
                  }, "没有返回可展示的授权命中。"))
                ])) : _createCommentVNode("v-if", true)
              ])
            ];
          }),
          _: 1
          /* STABLE */
        }, 8, ["role"]);
      };
    })()
  };
  const { ref: ref$1, computed: computed$1, onMounted: onMounted$1, onUnmounted: onUnmounted$1, watch: watch$1 } = Vue;
  const titles = {
    "/admin": "平台总览",
    "/admin/applications": "商户审核",
    "/admin/merchants": "商户监管",
    "/admin/products": "商品监管",
    "/admin/orders": "订单监管",
    "/admin/disputes": "争议处理",
    "/admin/categories": "分类管理"
  };
  const Platform = {
    name: "Platform",
    components: { BackofficeShell, ProductImage, StatusPanel: _sfc_main },
    setup() {
      const scope = requestScope();
      const route = computed$1(() => store.route), title = computed$1(() => titles[route.value] || "平台总览");
      const stats = ref$1(null), applications = ref$1([]), merchants = ref$1([]), products = ref$1([]), orders = ref$1([]), aftersales = ref$1([]), categories = ref$1([]);
      const selectedId = ref$1(""), search = ref$1(""), state = ref$1(""), page = ref$1(1), pageInfo = ref$1({ total: 0, hasNext: false }), reason = ref$1(""), historyEvents = ref$1([]), historyLoading = ref$1(false), historyError = ref$1(""), category = ref$1({ code: "", name: "", active: true }), loading = ref$1(false), busy = ref$1(false), error = ref$1(""), allowed = ref$1(preview);
      let disputeVersion = 0;
      const pickedApplication = computed$1(
        () => applications.value.find((a) => a.applicationId === selectedId.value) || applications.value[0] || null
      );
      const filtered = computed$1(() => {
        const source = route.value === "/admin/applications" ? applications.value : route.value === "/admin/merchants" ? merchants.value : route.value === "/admin/products" ? products.value : route.value === "/admin/orders" ? orders.value : route.value === "/admin/disputes" ? aftersales.value : categories.value;
        if (!preview && ["/admin/applications", "/admin/merchants", "/admin/products", "/admin/orders"].includes(
          route.value
        ))
          return source;
        const q = search.value.trim().toLowerCase();
        return source.filter(
          (row) => (!q || route.value === "/admin/products" && !preview || Object.values(row).some((v) => typeof v === "string" && v.toLowerCase().includes(q))) && (!state.value || preview || ["/admin/merchants", "/admin/products"].includes(route.value) || row.status === state.value)
        );
      });
      let loadVersion = 0;
      async function load() {
        var _a;
        const request2 = scope.begin();
        const read = (path) => api(path, { signal: request2.signal });
        const stamp = ++loadVersion;
        const current = route.value;
        error.value = "";
        if (preview) {
          allowed.value = true;
          stats.value = { ...DEMO_STATS };
          applications.value = DEMO_APPLICATIONS;
          merchants.value = DEMO_MERCHANTS;
          products.value = DEMO_PRODUCTS;
          orders.value = DEMO_MERCHANT_ORDERS;
          aftersales.value = DEMO_AFTERSALES;
          categories.value = DEMO_CATEGORIES;
          return;
        }
        loading.value = true;
        try {
          if (stamp !== loadVersion) return;
          const actor = (_a = store.user) == null ? void 0 : _a.userId;
          const valid = () => {
            var _a2;
            return stamp === loadVersion && route.value === current && ((_a2 = store.user) == null ? void 0 : _a2.userId) === actor;
          };
          const work = store.workspace || await read("/workspace");
          if (!valid()) return;
          store.workspace = work;
          allowed.value = !!(work == null ? void 0 : work.platformAdmin);
          if (!allowed.value) return;
          if (current === "/admin") {
            const [s, m, o] = await Promise.all([
              read("/admin/statistics"),
              read("/admin/merchants/page" + query({ page: 1, size: 6 })),
              read("/admin/orders/page" + query({ page: 1, size: 6 }))
            ]);
            if (!valid()) return;
            stats.value = s;
            merchants.value = m.items || [];
            orders.value = o.items || [];
          }
          if (current === "/admin/applications") {
            const result = await read(
              "/admin/merchant-applications/page" + query({ page: page.value, size: 12, state: state.value, q: search.value })
            );
            if (!valid()) return;
            applications.value = result.items || [];
            pageInfo.value = result;
          }
          if (current === "/admin/merchants") {
            const result = await read(
              "/admin/merchants/page" + query({ page: page.value, size: 12, q: search.value })
            );
            if (!valid()) return;
            merchants.value = result.items || [];
            pageInfo.value = result;
          }
          if (current === "/admin/products") {
            const result = await read(
              "/admin/products/page" + query({ page: page.value, size: 12, q: search.value })
            );
            if (!valid()) return;
            products.value = result.items || [];
            pageInfo.value = result;
          }
          if (current === "/admin/orders") {
            const result = await read(
              "/admin/orders/page" + query({ page: page.value, size: 12, state: state.value, q: search.value })
            );
            if (!valid()) return;
            orders.value = result.items || [];
            pageInfo.value = result;
          }
          if (current === "/admin/disputes") {
            const result = await read(
              "/admin/aftersales/page" + query({ page: page.value, size: 12, state: state.value })
            );
            if (!valid()) return;
            aftersales.value = result.items || [];
            pageInfo.value = result;
          }
          if (current === "/admin/categories") {
            const result = await read("/categories");
            if (!valid()) return;
            categories.value = result || [];
          }
        } catch (e) {
          if (stamp === loadVersion && route.value === current) error.value = e.message;
        } finally {
          if (stamp === loadVersion) loading.value = false;
        }
      }
      onMounted$1(load);
      onUnmounted$1(() => {
        ++loadVersion;
        clearTimeout(searchDelay);
      });
      let searchDelay;
      let resettingPage = false;
      watch$1(
        [page, search, state],
        (next, previous) => {
          if (resettingPage) return;
          clearTimeout(searchDelay);
          ++loadVersion;
          loading.value = true;
          const changed = next.slice(1).some((v, i) => v !== previous[i + 1]);
          if (changed) {
            resettingPage = true;
            page.value = 1;
            resettingPage = false;
          }
          searchDelay = setTimeout(load, next[1] !== previous[1] ? 280 : 0);
        },
        { flush: "sync" }
      );
      async function perform(path, body) {
        if (preview || busy.value || loading.value || !!error.value || !allowed.value) return;
        const current = scope.capture();
        busy.value = true;
        try {
          await api(path, { method: "POST", body });
          if (!current()) return;
          notify("操作成功");
          reason.value = "";
          await load();
        } catch (e) {
          if (current()) notify(e.message);
        } finally {
          if (current()) busy.value = false;
        }
      }
      function review(approved) {
        const a = pickedApplication.value;
        if (!a) return;
        if (!approved && !reason.value.trim()) {
          notify("请输入拒绝理由");
          return;
        }
        perform("/admin/merchant-applications/" + pathId(a.applicationId) + "/review", {
          approved,
          reason: reason.value
        });
      }
      function stateMerchant(m) {
        if (preview || busy.value || loading.value || !allowed.value) return;
        const active = m.status !== "ACTIVE";
        let comment = reason.value.trim();
        if (!active) {
          comment = window.prompt("请输入停用商户“" + m.name + "”的原因", comment);
          if (comment === null) return;
          comment = comment.trim();
          if (!comment || comment.length > 500) {
            notify("停用原因须为1~500字");
            return;
          }
        }
        if (!window.confirm("确定" + (active ? "启用" : "停用") + "商户“" + m.name + "”？")) return;
        perform("/admin/merchants/" + pathId(m.merchantId) + "/state", {
          active: m.status !== "ACTIVE",
          reason: comment || "平台管理操作"
        });
      }
      function forceProduct(p2) {
        if (preview || busy.value || loading.value || !allowed.value) return;
        if (!window.confirm("确定强制下架商品“" + p2.title + "”？")) return;
        perform("/admin/products/" + pathId(p2.productId) + "/unpublish");
      }
      async function openDispute(afterSale) {
        const version2 = ++disputeVersion;
        selectedId.value = afterSale.id;
        reason.value = "";
        historyEvents.value = [];
        historyError.value = "";
        if (preview) return;
        historyLoading.value = true;
        try {
          const detail = await api("/orders/" + pathId(afterSale.orderId));
          if (version2 !== disputeVersion || selectedId.value !== afterSale.id) return;
          historyEvents.value = (detail.events || []).filter(
            (e) => e.type.startsWith("REFUND_") || e.type.startsWith("MERCHANT_") || e.type.startsWith("PLATFORM_")
          );
        } catch (e) {
          if (version2 === disputeVersion) historyError.value = e.message;
        } finally {
          if (version2 === disputeVersion) historyLoading.value = false;
        }
      }
      function decideRefund(a, approved) {
        var _a;
        if (((_a = aftersales.value.find((row) => row.id === (a == null ? void 0 : a.id))) == null ? void 0 : _a.status) !== "DISPUTED") {
          notify("该售后已不处于争议状态，请刷新列表");
          return;
        }
        const comment = reason.value.trim();
        if (!a || !comment) {
          notify("请填写退款审核说明");
          return;
        }
        perform("/admin/orders/" + pathId(a.orderId) + "/refund-decision", {
          approved,
          reason: comment
        });
      }
      function saveCategory() {
        if (!category.value.code.trim() || !category.value.name.trim()) {
          notify("请填写分类信息");
          return;
        }
        perform("/admin/categories", { ...category.value });
      }
      function selectApplication(a) {
        selectedId.value = a.applicationId;
        reason.value = "";
      }
      const merchantName = (id, row) => {
        var _a;
        return (row == null ? void 0 : row.merchantName) || ((_a = merchants.value.find((m) => m.merchantId === id)) == null ? void 0 : _a.name) || id || "—";
      };
      return {
        store,
        route,
        title,
        stats,
        applications,
        merchants,
        products,
        orders,
        aftersales,
        categories,
        selectedId,
        search,
        state,
        page,
        pageInfo,
        reason,
        historyEvents,
        historyLoading,
        historyError,
        orderEventLabel,
        openDispute,
        category,
        busy,
        loading,
        error,
        allowed,
        pickedApplication,
        filtered,
        preview,
        go,
        money,
        priceSku,
        afterSaleStatusLabel,
        applicationStatusLabel,
        merchantStatusLabel,
        orderStatusLabel,
        productStatusLabel,
        dateTime,
        merchantName,
        load,
        review,
        stateMerchant,
        forceProduct,
        decideRefund,
        saveCategory,
        selectApplication
      };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode2, createTextVNode: _createTextVNode, createElementVNode: _createElementVNode, openBlock: _openBlock, createBlock: _createBlock, createCommentVNode: _createCommentVNode, createElementBlock: _createElementBlock, toDisplayString: _toDisplayString, renderList: _renderList, Fragment: _Fragment, vModelText: _vModelText, withDirectives: _withDirectives, vModelSelect: _vModelSelect, withModifiers: _withModifiers, normalizeClass: _normalizeClass, withCtx: _withCtx } = Vue;
      return function render2(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_StatusPanel = _resolveComponent("StatusPanel");
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_BackofficeShell = _resolveComponent("BackofficeShell");
        return _openBlock(), _createBlock(_component_BackofficeShell, {
          role: "admin",
          title: _ctx.title
        }, {
          actions: _withCtx(() => [
            _createElementVNode("button", {
              class: "outline-button small",
              onClick: _ctx.load
            }, [
              _createVNode2(_component_Icon, {
                name: "refresh",
                size: 16
              }),
              _createTextVNode("刷新")
            ], 8, ["onClick"])
          ]),
          default: _withCtx(() => [
            _ctx.loading ? (_openBlock(), _createBlock(_component_StatusPanel, {
              key: 0,
              state: "loading",
              message: "正在加载…"
            })) : _ctx.error ? (_openBlock(), _createBlock(_component_StatusPanel, {
              key: 1,
              state: "error",
              message: _ctx.error,
              "action-label": "重新加载",
              busy: _ctx.loading,
              onRetry: _ctx.load
            }, null, 8, ["message", "busy", "onRetry"])) : !_ctx.allowed && !_ctx.preview ? (_openBlock(), _createElementBlock("div", {
              key: 2,
              class: "ops-card access-denied"
            }, [
              _createVNode2(_component_Icon, {
                name: "shield",
                size: 38
              }),
              _createElementVNode("h2", null, "无权限访问")
            ])) : _ctx.route === "/admin" ? (_openBlock(), _createElementBlock(
              _Fragment,
              { key: 3 },
              [
                _ctx.stats ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "ops-kpis"
                }, [
                  _createElementVNode("div", null, [
                    _createElementVNode("span", null, "全部订单"),
                    _createElementVNode(
                      "strong",
                      null,
                      _toDisplayString(_ctx.stats.totalOrders || 0),
                      1
                      /* TEXT */
                    )
                  ]),
                  _createElementVNode("div", null, [
                    _createElementVNode("span", null, "待付款"),
                    _createElementVNode(
                      "strong",
                      null,
                      _toDisplayString(_ctx.stats.pendingCount || 0),
                      1
                      /* TEXT */
                    )
                  ]),
                  _createElementVNode("div", null, [
                    _createElementVNode("span", null, "已完成"),
                    _createElementVNode(
                      "strong",
                      null,
                      _toDisplayString(_ctx.stats.completedCount || 0),
                      1
                      /* TEXT */
                    )
                  ]),
                  _createElementVNode("div", null, [
                    _createElementVNode("span", null, "模拟交易金额"),
                    _createElementVNode(
                      "strong",
                      null,
                      _toDisplayString(_ctx.money(_ctx.stats.completedAmountCent)),
                      1
                      /* TEXT */
                    )
                  ])
                ])) : _createCommentVNode("v-if", true),
                _createElementVNode("div", { class: "ops-grid" }, [
                  _createElementVNode("section", { class: "ops-card" }, [
                    _createElementVNode("div", { class: "ops-card-header" }, [
                      _createElementVNode("h2", null, "近期订单"),
                      _createElementVNode("button", {
                        onClick: ($event) => _ctx.go("/admin/orders")
                      }, [
                        _createTextVNode("全部 "),
                        _createVNode2(_component_Icon, {
                          name: "chevronRight",
                          size: 16
                        })
                      ], 8, ["onClick"])
                    ]),
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.orders.slice(0, 6), (o) => {
                        return _openBlock(), _createElementBlock("div", {
                          class: "ops-list-line",
                          key: o.orderId
                        }, [
                          _createElementVNode("span", { class: "mini-icon" }, [
                            _createVNode2(_component_Icon, { name: "order" })
                          ]),
                          _createElementVNode("div", null, [
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(o.orderId),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode(
                              "small",
                              null,
                              _toDisplayString(_ctx.dateTime(o.createdAt)),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode(
                            "b",
                            null,
                            _toDisplayString(_ctx.money(o.totalCent)),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "span",
                            { class: "status-tag" },
                            _toDisplayString(_ctx.orderStatusLabel(o.status)),
                            1
                            /* TEXT */
                          )
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    )),
                    !_ctx.orders.length ? (_openBlock(), _createElementBlock("div", {
                      key: 0,
                      class: "admin-empty"
                    }, "暂无订单")) : _createCommentVNode("v-if", true)
                  ]),
                  _createElementVNode("section", { class: "ops-card" }, [
                    _createElementVNode("div", { class: "ops-card-header" }, [
                      _createElementVNode("h2", null, "运营入口")
                    ]),
                    _createElementVNode("div", { class: "ops-quick" }, [
                      _createElementVNode("button", {
                        onClick: ($event) => _ctx.go("/admin/applications")
                      }, [
                        _createVNode2(_component_Icon, { name: "store" }),
                        _createTextVNode("商户审核")
                      ], 8, ["onClick"]),
                      _createElementVNode("button", {
                        onClick: ($event) => _ctx.go("/admin/merchants")
                      }, [
                        _createVNode2(_component_Icon, { name: "users" }),
                        _createTextVNode("商户监管")
                      ], 8, ["onClick"]),
                      _createElementVNode("button", {
                        onClick: ($event) => _ctx.go("/admin/disputes")
                      }, [
                        _createVNode2(_component_Icon, { name: "shield" }),
                        _createTextVNode("争议处理")
                      ], 8, ["onClick"]),
                      _createElementVNode("button", {
                        onClick: ($event) => _ctx.go("/admin/knowledge")
                      }, [
                        _createVNode2(_component_Icon, { name: "book" }),
                        _createTextVNode("知识库")
                      ], 8, ["onClick"])
                    ])
                  ])
                ])
              ],
              64
              /* STABLE_FRAGMENT */
            )) : _ctx.route === "/admin/applications" ? (_openBlock(), _createElementBlock("div", {
              key: 4,
              class: "ops-grid admin-review-grid"
            }, [
              _createElementVNode("section", { class: "ops-card" }, [
                _createElementVNode("div", { class: "ops-card-header" }, [
                  _createElementVNode("h2", null, "入驻申请"),
                  _createElementVNode(
                    "span",
                    null,
                    _toDisplayString(_ctx.preview ? _ctx.applications.length : _ctx.pageInfo.total) + " 条",
                    1
                    /* TEXT */
                  )
                ]),
                _createElementVNode("div", { class: "ops-toolbar" }, [
                  _createElementVNode("label", { class: "ops-search" }, [
                    _createVNode2(_component_Icon, {
                      name: "search",
                      size: 16
                    }),
                    _withDirectives(_createElementVNode("input", {
                      "onUpdate:modelValue": ($event) => _ctx.search = $event,
                      placeholder: "商户 / 申请人"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.search]
                    ])
                  ]),
                  _withDirectives(_createElementVNode("select", {
                    class: "admin-input compact-select",
                    "onUpdate:modelValue": ($event) => _ctx.state = $event
                  }, [
                    _createElementVNode("option", { value: "" }, "全部状态"),
                    _createElementVNode("option", { value: "SUBMITTED" }, "待审核"),
                    _createElementVNode("option", { value: "APPROVED" }, "已通过"),
                    _createElementVNode("option", { value: "REJECTED" }, "已拒绝")
                  ], 8, ["onUpdate:modelValue"]), [
                    [_vModelSelect, _ctx.state]
                  ])
                ]),
                _createElementVNode("div", { class: "ops-table-wrap" }, [
                  _createElementVNode("table", { class: "ops-table" }, [
                    _createElementVNode("thead", null, [
                      _createElementVNode("tr", null, [
                        _createElementVNode("th", null, "商户"),
                        _createElementVNode("th", null, "申请人"),
                        _createElementVNode("th", null, "门店"),
                        _createElementVNode("th", null, "状态"),
                        _createElementVNode("th")
                      ])
                    ]),
                    _createElementVNode("tbody", null, [
                      (_openBlock(true), _createElementBlock(
                        _Fragment,
                        null,
                        _renderList(_ctx.filtered, (a) => {
                          var _a, _b;
                          return _openBlock(), _createElementBlock("tr", {
                            key: a.applicationId,
                            class: _normalizeClass({ active: ((_a = _ctx.pickedApplication) == null ? void 0 : _a.applicationId) === a.applicationId }),
                            onClick: ($event) => _ctx.selectApplication(a)
                          }, [
                            _createElementVNode("td", null, [
                              _createElementVNode("button", {
                                class: "row-link",
                                onClick: _withModifiers(($event) => _ctx.selectApplication(a), ["stop"]),
                                "aria-pressed": ((_b = _ctx.pickedApplication) == null ? void 0 : _b.applicationId) === a.applicationId
                              }, _toDisplayString(a.merchantName), 9, ["onClick", "aria-pressed"]),
                              _createElementVNode(
                                "small",
                                null,
                                _toDisplayString(a.category),
                                1
                                /* TEXT */
                              )
                            ]),
                            _createElementVNode(
                              "td",
                              null,
                              _toDisplayString(a.contactName),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode(
                              "td",
                              null,
                              _toDisplayString(a.storeName),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode("td", null, [
                              _createElementVNode(
                                "span",
                                {
                                  class: _normalizeClass(["status-tag", a.status === "APPROVED" ? "published" : "draft"])
                                },
                                _toDisplayString(_ctx.applicationStatusLabel(a.status)),
                                3
                                /* TEXT, CLASS */
                              )
                            ]),
                            _createElementVNode("td", null, [
                              _createVNode2(_component_Icon, {
                                name: "chevronRight",
                                size: 16
                              })
                            ])
                          ], 10, ["onClick"]);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      ))
                    ])
                  ])
                ]),
                !_ctx.filtered.length ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "admin-empty"
                }, "无符合条件的申请")) : _createCommentVNode("v-if", true)
              ]),
              _ctx.pickedApplication ? (_openBlock(), _createElementBlock("aside", {
                key: 0,
                class: "ops-card ops-sideform"
              }, [
                _createElementVNode(
                  "h2",
                  null,
                  _toDisplayString(_ctx.pickedApplication.merchantName),
                  1
                  /* TEXT */
                ),
                _createElementVNode(
                  "span",
                  { class: "status-tag" },
                  _toDisplayString(_ctx.applicationStatusLabel(_ctx.pickedApplication.status)),
                  1
                  /* TEXT */
                ),
                _createElementVNode("div", { class: "inspector-row" }, [
                  _createElementVNode("span", null, "申请编号"),
                  _createElementVNode(
                    "strong",
                    null,
                    _toDisplayString(_ctx.pickedApplication.applicationId),
                    1
                    /* TEXT */
                  )
                ]),
                _createElementVNode("div", { class: "inspector-row" }, [
                  _createElementVNode("span", null, "联系人"),
                  _createElementVNode(
                    "strong",
                    null,
                    _toDisplayString(_ctx.pickedApplication.contactName),
                    1
                    /* TEXT */
                  )
                ]),
                _createElementVNode("div", { class: "inspector-row" }, [
                  _createElementVNode("span", null, "联系电话"),
                  _createElementVNode(
                    "strong",
                    null,
                    _toDisplayString(_ctx.pickedApplication.contactPhone),
                    1
                    /* TEXT */
                  )
                ]),
                _createElementVNode("div", { class: "inspector-row" }, [
                  _createElementVNode("span", null, "门店"),
                  _createElementVNode(
                    "strong",
                    null,
                    _toDisplayString(_ctx.pickedApplication.storeName),
                    1
                    /* TEXT */
                  )
                ]),
                _createElementVNode("div", { class: "inspector-row" }, [
                  _createElementVNode("span", null, "位置"),
                  _createElementVNode(
                    "strong",
                    null,
                    _toDisplayString(_ctx.pickedApplication.location),
                    1
                    /* TEXT */
                  )
                ]),
                _ctx.pickedApplication.rejectionReason ? (_openBlock(), _createElementBlock(
                  "div",
                  {
                    key: 0,
                    class: "inline-error"
                  },
                  _toDisplayString(_ctx.pickedApplication.rejectionReason),
                  1
                  /* TEXT */
                )) : _createCommentVNode("v-if", true),
                _ctx.pickedApplication.status === "SUBMITTED" ? (_openBlock(), _createElementBlock(
                  _Fragment,
                  { key: 1 },
                  [
                    _createElementVNode("label", {
                      class: "field-label",
                      for: "platform-field-1"
                    }, "审核意见"),
                    _withDirectives(_createElementVNode("textarea", {
                      id: "platform-field-1",
                      class: "admin-input",
                      "onUpdate:modelValue": ($event) => _ctx.reason = $event,
                      rows: "3",
                      maxlength: "500",
                      placeholder: "拒绝时必须填写原因"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.reason]
                    ]),
                    _createElementVNode("div", { class: "form-buttons" }, [
                      _createElementVNode("button", {
                        class: "outline-button",
                        disabled: _ctx.loading || !!_ctx.error || _ctx.preview || _ctx.busy || !_ctx.reason.trim(),
                        onClick: ($event) => _ctx.review(false)
                      }, "驳回", 8, ["disabled", "onClick"]),
                      _createElementVNode("button", {
                        class: "teal-button",
                        disabled: _ctx.loading || !!_ctx.error || _ctx.preview || _ctx.busy,
                        onClick: ($event) => _ctx.review(true)
                      }, "通过审核", 8, ["disabled", "onClick"])
                    ])
                  ],
                  64
                  /* STABLE_FRAGMENT */
                )) : _createCommentVNode("v-if", true)
              ])) : _createCommentVNode("v-if", true)
            ])) : _ctx.route === "/admin/merchants" ? (_openBlock(), _createElementBlock("section", {
              key: 5,
              class: "ops-card"
            }, [
              _createElementVNode("div", { class: "ops-card-header" }, [
                _createElementVNode("h2", null, "商户列表"),
                _createElementVNode(
                  "span",
                  null,
                  _toDisplayString(_ctx.preview ? _ctx.merchants.length : _ctx.pageInfo.total) + " 家",
                  1
                  /* TEXT */
                )
              ]),
              _createElementVNode("label", { class: "ops-search" }, [
                _createVNode2(_component_Icon, {
                  name: "search",
                  size: 17
                }),
                _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": ($event) => _ctx.search = $event,
                  placeholder: "搜索经营名称"
                }, null, 8, ["onUpdate:modelValue"]), [
                  [_vModelText, _ctx.search]
                ])
              ]),
              _createElementVNode("div", { class: "ops-table-wrap" }, [
                _createElementVNode("table", { class: "ops-table" }, [
                  _createElementVNode("thead", null, [
                    _createElementVNode("tr", null, [
                      _createElementVNode("th", null, "商户"),
                      _createElementVNode("th", null, "品类"),
                      _createElementVNode("th", null, "首个门店"),
                      _createElementVNode("th", null, "自提位置"),
                      _createElementVNode("th", null, "状态"),
                      _createElementVNode("th", null, "操作")
                    ])
                  ]),
                  _createElementVNode("tbody", null, [
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.filtered, (m) => {
                        return _openBlock(), _createElementBlock("tr", {
                          key: m.merchantId
                        }, [
                          _createElementVNode("td", null, [
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(m.name),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode(
                              "small",
                              null,
                              _toDisplayString(m.merchantId),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode(
                            "td",
                            null,
                            _toDisplayString(m.category),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "td",
                            null,
                            _toDisplayString(m.storeName),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "td",
                            null,
                            _toDisplayString(m.location),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode("td", null, [
                            _createElementVNode(
                              "span",
                              {
                                class: _normalizeClass(["status-tag", m.status === "ACTIVE" ? "published" : "draft"])
                              },
                              _toDisplayString(_ctx.merchantStatusLabel(m.status)),
                              3
                              /* TEXT, CLASS */
                            )
                          ]),
                          _createElementVNode("td", null, [
                            _createElementVNode("button", {
                              class: "row-link",
                              disabled: _ctx.loading || !!_ctx.error || _ctx.preview || _ctx.busy,
                              onClick: ($event) => _ctx.stateMerchant(m)
                            }, _toDisplayString(m.status === "ACTIVE" ? "停用" : "恢复"), 9, ["disabled", "onClick"])
                          ])
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ])
                ])
              ])
            ])) : _ctx.route === "/admin/products" ? (_openBlock(), _createElementBlock("section", {
              key: 6,
              class: "ops-card"
            }, [
              _createElementVNode("div", { class: "ops-card-header" }, [
                _createElementVNode("h2", null, "商品监管"),
                _createElementVNode(
                  "span",
                  null,
                  _toDisplayString(_ctx.preview ? _ctx.products.length : _ctx.pageInfo.total) + " 件",
                  1
                  /* TEXT */
                )
              ]),
              _createElementVNode("label", { class: "ops-search" }, [
                _createVNode2(_component_Icon, {
                  name: "search",
                  size: 17
                }),
                _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": ($event) => _ctx.search = $event,
                  placeholder: "搜索商品 / 商户"
                }, null, 8, ["onUpdate:modelValue"]), [
                  [_vModelText, _ctx.search]
                ])
              ]),
              _createElementVNode("div", { class: "ops-table-wrap" }, [
                _createElementVNode("table", { class: "ops-table" }, [
                  _createElementVNode("thead", null, [
                    _createElementVNode("tr", null, [
                      _createElementVNode("th", null, "商品"),
                      _createElementVNode("th", null, "商户"),
                      _createElementVNode("th", null, "分类"),
                      _createElementVNode("th", null, "售价"),
                      _createElementVNode("th", null, "状态"),
                      _createElementVNode("th", null, "操作")
                    ])
                  ]),
                  _createElementVNode("tbody", null, [
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.filtered, (p2) => {
                        return _openBlock(), _createElementBlock("tr", {
                          key: p2.productId
                        }, [
                          _createElementVNode("td", null, [
                            _createElementVNode("div", { class: "table-product-cell" }, [
                              _createVNode2(_component_ProductImage, {
                                src: p2.imageUrl,
                                alt: p2.title
                              }, null, 8, ["src", "alt"]),
                              _createElementVNode("div", null, [
                                _createElementVNode(
                                  "strong",
                                  null,
                                  _toDisplayString(p2.title),
                                  1
                                  /* TEXT */
                                ),
                                _createElementVNode(
                                  "span",
                                  null,
                                  _toDisplayString(p2.productId),
                                  1
                                  /* TEXT */
                                )
                              ])
                            ])
                          ]),
                          _createElementVNode(
                            "td",
                            null,
                            _toDisplayString(_ctx.merchantName(p2.merchantId, p2)),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "td",
                            null,
                            _toDisplayString(p2.categoryCode),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "td",
                            null,
                            _toDisplayString(_ctx.priceSku(p2) ? _ctx.money(_ctx.priceSku(p2).priceCent) + " 起" : "暂无有效规格"),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode("td", null, [
                            _createElementVNode(
                              "span",
                              { class: "status-tag" },
                              _toDisplayString(_ctx.productStatusLabel(p2.status)),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode("td", null, [
                            _createElementVNode("button", {
                              class: "row-link",
                              disabled: _ctx.loading || !!_ctx.error || _ctx.preview || _ctx.busy || p2.status !== "PUBLISHED",
                              onClick: ($event) => _ctx.forceProduct(p2)
                            }, "强制下架", 8, ["disabled", "onClick"])
                          ])
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ])
                ])
              ])
            ])) : _ctx.route === "/admin/orders" ? (_openBlock(), _createElementBlock("section", {
              key: 7,
              class: "ops-card"
            }, [
              _createElementVNode("div", { class: "ops-card-header" }, [
                _createElementVNode("h2", null, "订单监管"),
                _createElementVNode(
                  "span",
                  null,
                  _toDisplayString(_ctx.preview ? _ctx.orders.length : _ctx.pageInfo.total) + " 笔",
                  1
                  /* TEXT */
                )
              ]),
              _createElementVNode("label", { class: "ops-search" }, [
                _createVNode2(_component_Icon, {
                  name: "search",
                  size: 17
                }),
                _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": ($event) => _ctx.search = $event,
                  placeholder: "订单号"
                }, null, 8, ["onUpdate:modelValue"]), [
                  [_vModelText, _ctx.search]
                ])
              ]),
              _createElementVNode("div", { class: "ops-table-wrap" }, [
                _createElementVNode("table", { class: "ops-table" }, [
                  _createElementVNode("thead", null, [
                    _createElementVNode("tr", null, [
                      _createElementVNode("th", null, "订单"),
                      _createElementVNode("th", null, "商户"),
                      _createElementVNode("th", null, "实付金额"),
                      _createElementVNode("th", null, "状态"),
                      _createElementVNode("th", null, "创建时间")
                    ])
                  ]),
                  _createElementVNode("tbody", null, [
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.filtered, (o) => {
                        var _a, _b;
                        return _openBlock(), _createElementBlock("tr", {
                          key: o.orderId
                        }, [
                          _createElementVNode("td", null, [
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(o.orderId),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode(
                              "small",
                              null,
                              _toDisplayString(((_b = (_a = o.items) == null ? void 0 : _a[0]) == null ? void 0 : _b.title) || "—"),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode(
                            "td",
                            null,
                            _toDisplayString(_ctx.merchantName(o.merchantId, o)),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "td",
                            null,
                            _toDisplayString(_ctx.money(o.totalCent)),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode("td", null, [
                            _createElementVNode(
                              "span",
                              { class: "status-tag" },
                              _toDisplayString(_ctx.orderStatusLabel(o.status)),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode(
                            "td",
                            null,
                            _toDisplayString(_ctx.dateTime(o.createdAt)),
                            1
                            /* TEXT */
                          )
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ])
                ])
              ])
            ])) : _ctx.route === "/admin/disputes" ? (_openBlock(), _createElementBlock("section", {
              key: 8,
              class: "ops-card"
            }, [
              _createElementVNode("div", { class: "ops-card-header" }, [
                _createElementVNode("h2", null, "售后争议"),
                _createElementVNode(
                  "span",
                  null,
                  _toDisplayString(_ctx.aftersales.length) + " 条",
                  1
                  /* TEXT */
                )
              ]),
              _createElementVNode("div", { class: "ops-toolbar" }, [
                _withDirectives(_createElementVNode("select", {
                  class: "admin-input compact-select",
                  "onUpdate:modelValue": ($event) => _ctx.state = $event,
                  onChange: ($event) => {
                    _ctx.page = 1;
                    _ctx.load();
                  }
                }, [
                  _createElementVNode("option", { value: "" }, "全部状态"),
                  _createElementVNode("option", { value: "REQUESTED" }, "待商户审核"),
                  _createElementVNode("option", { value: "DISPUTED" }, "待平台裁决"),
                  _createElementVNode("option", { value: "REFUNDED" }, "已退款"),
                  _createElementVNode("option", { value: "REJECTED" }, "已驳回")
                ], 40, ["onUpdate:modelValue", "onChange"]), [
                  [_vModelSelect, _ctx.state]
                ])
              ]),
              (_openBlock(true), _createElementBlock(
                _Fragment,
                null,
                _renderList(_ctx.aftersales, (a) => {
                  return _openBlock(), _createElementBlock("div", {
                    class: "ops-list-line dispute-line",
                    key: a.id
                  }, [
                    _createElementVNode("span", { class: "mini-icon" }, [
                      _createVNode2(_component_Icon, { name: "shield" })
                    ]),
                    _createElementVNode("div", null, [
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(a.orderId),
                        1
                        /* TEXT */
                      ),
                      _createElementVNode(
                        "small",
                        null,
                        _toDisplayString(a.reason),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createElementVNode(
                      "span",
                      { class: "status-tag" },
                      _toDisplayString(_ctx.afterSaleStatusLabel(a.status)),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("button", {
                      class: "outline-button small",
                      onClick: ($event) => _ctx.openDispute(a)
                    }, _toDisplayString(a.status === "DISPUTED" ? "查看处理" : "查看历程"), 9, ["onClick"])
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              )),
              !_ctx.aftersales.length ? (_openBlock(), _createElementBlock("div", {
                key: 0,
                class: "admin-empty"
              }, "暂无争议")) : _createCommentVNode("v-if", true),
              _ctx.selectedId && _ctx.aftersales.find((a) => a.id === _ctx.selectedId) ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "review-inline"
              }, [
                _createElementVNode(
                  "h3",
                  null,
                  _toDisplayString(_ctx.aftersales.find((a) => a.id === _ctx.selectedId).status === "DISPUTED" ? "裁决" : "处理历程") + " · " + _toDisplayString(_ctx.aftersales.find((a) => a.id === _ctx.selectedId).orderId),
                  1
                  /* TEXT */
                ),
                _createElementVNode("div", { class: "review-history" }, [
                  _createElementVNode("strong", null, "处理历程"),
                  _ctx.historyEvents.length ? (_openBlock(), _createElementBlock("ol", { key: 0 }, [
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.historyEvents, (e, i) => {
                        return _openBlock(), _createElementBlock("li", {
                          key: e.eventId || i
                        }, [
                          _createElementVNode(
                            "b",
                            null,
                            _toDisplayString(_ctx.orderEventLabel(e.type)),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode("small", null, [
                            _createTextVNode(
                              _toDisplayString(_ctx.dateTime(e.occurredAt)),
                              1
                              /* TEXT */
                            ),
                            e.reason ? (_openBlock(), _createElementBlock(
                              _Fragment,
                              { key: 0 },
                              [
                                _createTextVNode(
                                  " · " + _toDisplayString(e.reason),
                                  1
                                  /* TEXT */
                                )
                              ],
                              64
                              /* STABLE_FRAGMENT */
                            )) : _createCommentVNode("v-if", true)
                          ])
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ])) : _ctx.historyLoading ? (_openBlock(), _createElementBlock("p", {
                    key: 1,
                    class: "muted-short"
                  }, "正在加载处理历程…")) : (_openBlock(), _createElementBlock(
                    "p",
                    {
                      key: 2,
                      class: "muted-short"
                    },
                    _toDisplayString(_ctx.historyError || "历史记录不完整，仅显示当前状态"),
                    1
                    /* TEXT */
                  ))
                ]),
                _ctx.aftersales.find((a) => a.id === _ctx.selectedId).status === "DISPUTED" ? (_openBlock(), _createElementBlock(
                  _Fragment,
                  { key: 0 },
                  [
                    _createElementVNode("label", {
                      class: "field-label",
                      for: "platform-field-2"
                    }, "裁决说明"),
                    _withDirectives(_createElementVNode("textarea", {
                      id: "platform-field-2",
                      class: "admin-input",
                      "onUpdate:modelValue": ($event) => _ctx.reason = $event,
                      rows: "3",
                      maxlength: "500",
                      placeholder: "审核说明（必填）"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.reason]
                    ]),
                    _createElementVNode("div", { class: "form-buttons" }, [
                      _createElementVNode("button", {
                        class: "outline-button",
                        disabled: _ctx.loading || !!_ctx.error || _ctx.preview || _ctx.busy || !_ctx.reason.trim(),
                        onClick: ($event) => _ctx.decideRefund(_ctx.aftersales.find((a) => a.id === _ctx.selectedId), false)
                      }, "驳回", 8, ["disabled", "onClick"]),
                      _createElementVNode("button", {
                        class: "teal-button",
                        disabled: _ctx.loading || !!_ctx.error || _ctx.preview || _ctx.busy || !_ctx.reason.trim(),
                        onClick: ($event) => _ctx.decideRefund(_ctx.aftersales.find((a) => a.id === _ctx.selectedId), true)
                      }, "批准退款", 8, ["disabled", "onClick"])
                    ])
                  ],
                  64
                  /* STABLE_FRAGMENT */
                )) : _createCommentVNode("v-if", true)
              ])) : _createCommentVNode("v-if", true)
            ])) : _ctx.route === "/admin/categories" ? (_openBlock(), _createElementBlock("div", {
              key: 9,
              class: "ops-grid"
            }, [
              _createElementVNode("section", { class: "ops-card" }, [
                _createElementVNode("div", { class: "ops-card-header" }, [
                  _createElementVNode("h2", null, "类目"),
                  _createElementVNode(
                    "span",
                    null,
                    _toDisplayString(_ctx.categories.length) + " 个",
                    1
                    /* TEXT */
                  )
                ]),
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.categories, (c) => {
                    return _openBlock(), _createElementBlock("div", {
                      class: "ops-list-line",
                      key: c.code
                    }, [
                      _createElementVNode("span", { class: "mini-icon" }, [
                        _createVNode2(_component_Icon, { name: "grid" })
                      ]),
                      _createElementVNode("div", null, [
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(c.name),
                          1
                          /* TEXT */
                        ),
                        _createElementVNode(
                          "small",
                          null,
                          _toDisplayString(c.code),
                          1
                          /* TEXT */
                        )
                      ]),
                      _createElementVNode(
                        "span",
                        {
                          class: _normalizeClass(["status-tag", c.active ? "published" : "draft"])
                        },
                        _toDisplayString(c.active ? "启用" : "停用"),
                        3
                        /* TEXT, CLASS */
                      ),
                      _createElementVNode("button", {
                        class: "row-link",
                        onClick: ($event) => _ctx.category = { code: c.code, name: c.name, active: !c.active },
                        disabled: _ctx.preview
                      }, _toDisplayString(c.active ? "停用" : "恢复"), 9, ["onClick", "disabled"])
                    ]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ]),
              _createElementVNode("form", {
                class: "ops-card ops-sideform",
                onSubmit: _withModifiers(_ctx.saveCategory, ["prevent"])
              }, [
                _createElementVNode("h2", null, "编辑分类"),
                _createElementVNode("label", {
                  class: "field-label",
                  for: "platform-field-3"
                }, "编码"),
                _withDirectives(_createElementVNode("input", {
                  id: "platform-field-3",
                  class: "admin-input",
                  "onUpdate:modelValue": ($event) => _ctx.category.code = $event,
                  required: "",
                  maxlength: "32"
                }, null, 8, ["onUpdate:modelValue"]), [
                  [
                    _vModelText,
                    _ctx.category.code,
                    void 0,
                    { trim: true }
                  ]
                ]),
                _createElementVNode("label", {
                  class: "field-label",
                  for: "platform-field-4"
                }, "名称"),
                _withDirectives(_createElementVNode("input", {
                  id: "platform-field-4",
                  class: "admin-input",
                  "onUpdate:modelValue": ($event) => _ctx.category.name = $event,
                  required: "",
                  maxlength: "50"
                }, null, 8, ["onUpdate:modelValue"]), [
                  [
                    _vModelText,
                    _ctx.category.name,
                    void 0,
                    { trim: true }
                  ]
                ]),
                _createElementVNode("label", {
                  class: "field-label",
                  for: "platform-field-5"
                }, "状态"),
                _withDirectives(_createElementVNode("select", {
                  id: "platform-field-5",
                  class: "admin-input",
                  "onUpdate:modelValue": ($event) => _ctx.category.active = $event
                }, [
                  _createElementVNode("option", { value: true }, "启用"),
                  _createElementVNode("option", { value: false }, "停用")
                ], 8, ["onUpdate:modelValue"]), [
                  [_vModelSelect, _ctx.category.active]
                ]),
                _createElementVNode("button", {
                  type: "submit",
                  class: "teal-button",
                  disabled: _ctx.loading || !!_ctx.error || _ctx.preview || _ctx.busy
                }, _toDisplayString(_ctx.preview ? "设计预览" : "保存分类"), 9, ["disabled"])
              ], 40, ["onSubmit"])
            ])) : _createCommentVNode("v-if", true),
            !_ctx.preview && _ctx.route !== "/admin" && _ctx.route !== "/admin/categories" && _ctx.pageInfo.total > 0 ? (_openBlock(), _createElementBlock("div", {
              key: 10,
              class: "sdd-pager"
            }, [
              _createElementVNode(
                "span",
                null,
                "共 " + _toDisplayString(_ctx.pageInfo.total) + " 条",
                1
                /* TEXT */
              ),
              _createElementVNode("button", {
                disabled: _ctx.page <= 1,
                onClick: ($event) => _ctx.page--
              }, "上一页", 8, ["disabled", "onClick"]),
              _createElementVNode(
                "span",
                null,
                _toDisplayString(_ctx.page),
                1
                /* TEXT */
              ),
              _createElementVNode("button", {
                disabled: !_ctx.pageInfo.hasNext,
                onClick: ($event) => _ctx.page++
              }, "下一页", 8, ["disabled", "onClick"])
            ])) : _createCommentVNode("v-if", true)
          ]),
          _: 1
          /* STABLE */
        }, 8, ["title"]);
      };
    })()
  };
  const { ref, computed, onMounted, onUnmounted, watch } = Vue;
  const RoleManager = {
    name: "RoleManager",
    components: { BackofficeShell },
    setup() {
      const roles = ref([]), permissions = ref([]), selected = ref(""), name = ref(""), grants = ref([]);
      const error = ref(""), busy = ref(false), loading = ref(false), count = ref(0);
      const canManage = computed(() => hasPermission("role.manage"));
      const current = computed(() => roles.value.find((r) => r.code === selected.value) || null);
      const assigned = computed(() => count.value);
      let epoch = 0;
      const prefix = () => "/merchants/" + pathId(store.merchantId) + "/rbac";
      function reset() {
        selected.value = "";
        name.value = "";
        grants.value = [];
        roles.value = [];
        permissions.value = [];
        count.value = 0;
      }
      function choose(role) {
        selected.value = role.code;
        name.value = role.name;
        grants.value = [...role.permissions || []];
      }
      function create() {
        selected.value = "";
        name.value = "";
        grants.value = ["product.read", "order.read"];
      }
      function checked(code) {
        return grants.value.includes(code);
      }
      function toggle(code, enabled) {
        const dependency = {
          "product.write": "product.read",
          "stock.replenish": "stock.read",
          "order.prepare": "order.read",
          "pickup.verify": "order.read",
          "aftersale.review": "aftersale.read",
          "knowledge.manage": "knowledge.read",
          "dashboard.read": "order.read"
        };
        let values = new Set(grants.value);
        if (enabled) {
          values.add(code);
          if (dependency[code]) values.add(dependency[code]);
        } else {
          values.delete(code);
          for (const [action, read] of Object.entries(dependency))
            if (read === code) values.delete(action);
        }
        grants.value = [...values];
      }
      async function load() {
        var _a, _b, _c;
        const stamp = ++epoch, mid = store.merchantId, actor = (_a = store.user) == null ? void 0 : _a.userId;
        reset();
        error.value = "";
        if (preview) {
          roles.value = DEMO_RBAC_ROLES.map((r) => ({ ...r, permissions: [...r.permissions] }));
          permissions.value = DEMO_RBAC_PERMISSIONS;
          count.value = DEMO_MEMBERS.length;
          choose(roles.value[0]);
          return;
        }
        loading.value = true;
        try {
          if (!mid) await loadMerchant();
          const id = store.merchantId, uid2 = (_b = store.user) == null ? void 0 : _b.userId;
          if (stamp !== epoch || (!mid ? false : mid !== id) || !hasPermission("role.manage")) return;
          const [rs, ps, ms] = await Promise.all([
            api(prefix() + "/roles"),
            api(prefix() + "/permissions"),
            api("/merchants/" + pathId(id) + "/members")
          ]);
          if (stamp !== epoch || store.merchantId !== id || ((_c = store.user) == null ? void 0 : _c.userId) !== uid2 || (!mid ? false : actor !== uid2))
            return;
          roles.value = rs || [];
          permissions.value = ps || [];
          count.value = (ms || []).filter((m) => m.status === "ACTIVE").length;
          if (roles.value.length) choose(roles.value[0]);
        } catch (e) {
          if (stamp === epoch) error.value = e.message;
        } finally {
          if (stamp === epoch) loading.value = false;
        }
      }
      async function save() {
        var _a, _b, _c;
        if (preview || busy.value || !canManage.value || ((_a = current.value) == null ? void 0 : _a.builtin)) return;
        if (!name.value.trim() || grants.value.length === 0) {
          notify("请输入角色名称并选择至少一项权限");
          return;
        }
        const id = store.merchantId, uid2 = (_b = store.user) == null ? void 0 : _b.userId, stamp = epoch;
        busy.value = true;
        try {
          const code = selected.value;
          const result = await api(prefix() + "/roles" + (code ? "/" + pathId(code) : ""), {
            method: code ? "PUT" : "POST",
            body: { name: name.value.trim(), permissions: grants.value }
          });
          if (stamp !== epoch || id !== store.merchantId || uid2 !== ((_c = store.user) == null ? void 0 : _c.userId)) return;
          notify(code ? "角色已更新" : "角色已创建");
          await load();
          if (id === store.merchantId) {
            const found = roles.value.find((r) => r.code === result.code);
            if (found) choose(found);
          }
        } catch (e) {
          if (stamp === epoch) notify(e.message);
        } finally {
          busy.value = false;
        }
      }
      async function remove2() {
        var _a, _b, _c, _d;
        if (preview || busy.value || !canManage.value || !selected.value || ((_a = current.value) == null ? void 0 : _a.builtin))
          return;
        if (!window.confirm("确定删除角色「" + ((_b = current.value) == null ? void 0 : _b.name) + "」？")) return;
        const id = store.merchantId, uid2 = (_c = store.user) == null ? void 0 : _c.userId, stamp = epoch;
        busy.value = true;
        try {
          await api(prefix() + "/roles/" + pathId(selected.value), { method: "DELETE" });
          if (stamp !== epoch || id !== store.merchantId || uid2 !== ((_d = store.user) == null ? void 0 : _d.userId)) return;
          notify("角色已删除");
          await load();
        } catch (e) {
          if (stamp === epoch) notify(e.message);
        } finally {
          busy.value = false;
        }
      }
      onMounted(load);
      onUnmounted(() => ++epoch);
      watch([() => store.merchantId, () => {
        var _a;
        return (_a = store.user) == null ? void 0 : _a.userId;
      }, canManage], load);
      return {
        store,
        roles,
        permissions,
        selected,
        name,
        grants,
        error,
        busy,
        loading,
        canManage,
        current,
        assigned,
        choose,
        create,
        checked,
        toggle,
        save,
        remove: remove2,
        preview
      };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode2, createTextVNode: _createTextVNode, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, toDisplayString: _toDisplayString, createElementVNode: _createElementVNode, renderList: _renderList, Fragment: _Fragment, normalizeClass: _normalizeClass, vModelText: _vModelText, withDirectives: _withDirectives, createBlock: _createBlock, withModifiers: _withModifiers, withCtx: _withCtx } = Vue;
      return function render2(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_BackofficeShell = _resolveComponent("BackofficeShell");
        return _openBlock(), _createBlock(_component_BackofficeShell, {
          role: "merchant",
          title: "角色权限"
        }, {
          actions: _withCtx(() => [
            _ctx.canManage ? (_openBlock(), _createElementBlock("button", {
              key: 0,
              class: "teal-button",
              onClick: _ctx.create,
              disabled: _ctx.preview || _ctx.busy
            }, [
              _createVNode2(_component_Icon, {
                name: "plus",
                size: 16
              }),
              _createTextVNode("新增自定义角色")
            ], 8, ["onClick", "disabled"])) : _createCommentVNode("v-if", true)
          ]),
          default: _withCtx(() => {
            var _a, _b, _c;
            return [
              _ctx.error ? (_openBlock(), _createElementBlock(
                "div",
                {
                  key: 0,
                  class: "inline-error"
                },
                _toDisplayString(_ctx.error),
                1
                /* TEXT */
              )) : _createCommentVNode("v-if", true),
              !_ctx.canManage ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "ops-card access-denied"
              }, [
                _createVNode2(_component_Icon, {
                  name: "shield",
                  size: 32
                }),
                _createElementVNode("h2", null, "无权管理角色")
              ])) : (_openBlock(), _createElementBlock("div", {
                key: 2,
                class: "ops-grid rbac-layout"
              }, [
                _createElementVNode("section", { class: "ops-card rbac-roles" }, [
                  _createElementVNode("div", { class: "ops-card-header" }, [
                    _createElementVNode("h2", null, "商户角色"),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.roles.length) + " 个 · " + _toDisplayString(_ctx.assigned) + " 名成员",
                      1
                      /* TEXT */
                    )
                  ]),
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(_ctx.roles, (r) => {
                      return _openBlock(), _createElementBlock("button", {
                        key: r.code,
                        class: _normalizeClass(["rbac-role", { active: _ctx.selected === r.code }]),
                        onClick: ($event) => _ctx.choose(r)
                      }, [
                        _createElementVNode("span", { class: "mini-icon" }, [
                          _createVNode2(_component_Icon, {
                            name: r.builtin ? "shield" : "users",
                            size: 18
                          }, null, 8, ["name"])
                        ]),
                        _createElementVNode("span", null, [
                          _createElementVNode(
                            "strong",
                            null,
                            _toDisplayString(r.name),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "small",
                            null,
                            _toDisplayString(r.builtin ? "内置角色" : r.permissions.length + " 项权限"),
                            1
                            /* TEXT */
                          )
                        ]),
                        _createVNode2(_component_Icon, {
                          name: "chevronRight",
                          size: 16
                        })
                      ], 10, ["onClick"]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  !_ctx.roles.length && !_ctx.loading ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "admin-empty"
                  }, "暂无角色")) : _createCommentVNode("v-if", true)
                ]),
                _createElementVNode("form", {
                  class: "ops-card rbac-editor",
                  onSubmit: _withModifiers(_ctx.save, ["prevent"])
                }, [
                  _createElementVNode("div", { class: "ops-card-header" }, [
                    _createElementVNode(
                      "h2",
                      null,
                      _toDisplayString(_ctx.selected ? "角色权限" : "创建新角色"),
                      1
                      /* TEXT */
                    ),
                    ((_a = _ctx.current) == null ? void 0 : _a.builtin) ? (_openBlock(), _createElementBlock("span", {
                      key: 0,
                      class: "status-tag"
                    }, "系统内置")) : _createCommentVNode("v-if", true)
                  ]),
                  _createElementVNode("label", {
                    class: "field-label",
                    for: "rolemanager-field-1"
                  }, "角色名称"),
                  _withDirectives(_createElementVNode("input", {
                    id: "rolemanager-field-1",
                    class: "admin-input",
                    "onUpdate:modelValue": ($event) => _ctx.name = $event,
                    maxlength: "40",
                    required: "",
                    disabled: _ctx.preview || !!((_b = _ctx.current) == null ? void 0 : _b.builtin) || _ctx.busy,
                    placeholder: "例如：商品管理员"
                  }, null, 8, ["onUpdate:modelValue", "disabled"]), [
                    [
                      _vModelText,
                      _ctx.name,
                      void 0,
                      { trim: true }
                    ]
                  ]),
                  _createElementVNode("h3", { class: "field-heading" }, [
                    _createTextVNode("权限配置 "),
                    _createElementVNode(
                      "span",
                      { class: "rbac-grant-count" },
                      "已选 " + _toDisplayString(_ctx.grants.length) + " 项",
                      1
                      /* TEXT */
                    )
                  ]),
                  _createElementVNode("div", { class: "rbac-permissions" }, [
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.permissions, (p2) => {
                        var _a2;
                        return _openBlock(), _createElementBlock("label", {
                          key: p2.code,
                          "data-permission": p2.code,
                          class: _normalizeClass(["rbac-permission", { protected: !p2.grantable }])
                        }, [
                          _createElementVNode("input", {
                            type: "checkbox",
                            checked: _ctx.checked(p2.code),
                            disabled: _ctx.preview || !!((_a2 = _ctx.current) == null ? void 0 : _a2.builtin) || !p2.grantable || _ctx.busy,
                            onChange: ($event) => _ctx.toggle(p2.code, $event.target.checked)
                          }, null, 40, ["checked", "disabled", "onChange"]),
                          _createElementVNode("span", null, [
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(p2.label),
                              1
                              /* TEXT */
                            )
                          ]),
                          !p2.grantable ? (_openBlock(), _createBlock(_component_Icon, {
                            key: 0,
                            name: "lock",
                            size: 15,
                            title: "仅经营者"
                          })) : _createCommentVNode("v-if", true)
                        ], 10, ["data-permission"]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ]),
                  !((_c = _ctx.current) == null ? void 0 : _c.builtin) ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "form-buttons"
                  }, [
                    _ctx.selected ? (_openBlock(), _createElementBlock("button", {
                      key: 0,
                      type: "button",
                      class: "outline-button",
                      disabled: _ctx.preview || _ctx.busy,
                      onClick: _ctx.remove
                    }, "删除角色", 8, ["disabled", "onClick"])) : _createCommentVNode("v-if", true),
                    _createElementVNode("button", {
                      type: "submit",
                      class: "teal-button",
                      disabled: _ctx.preview || _ctx.busy || !_ctx.grants.length || !_ctx.name.trim()
                    }, _toDisplayString(_ctx.busy ? "保存中" : "保存角色"), 9, ["disabled"])
                  ])) : _createCommentVNode("v-if", true)
                ], 40, ["onSubmit"])
              ]))
            ];
          }),
          _: 1
          /* STABLE */
        });
      };
    })()
  };
  const App = {
    name: "CampusApp",
    components: {
      AuthDialog,
      NotFound: {
        render: (() => {
          const { createElementVNode: _createElementVNode, openBlock: _openBlock, createElementBlock: _createElementBlock } = Vue;
          return function render2(_ctx, _cache) {
            return _openBlock(), _createElementBlock("main", { class: "mobile-empty" }, [
              _createElementVNode("h1", null, "404"),
              _createElementVNode("p", null, "页面不存在"),
              _createElementVNode("a", { href: "#/" }, "返回首页")
            ]);
          };
        })()
      },
      Home,
      Guide,
      Merchant,
      ProductDetail,
      Shop,
      Cart,
      Orders,
      Account,
      MerchantOps,
      Knowledge,
      KnowledgeDebug,
      Platform,
      RoleManager
    },
    setup() {
      const current = computed$h(() => {
        const r = store.route;
        if (r === "/merchant/products") return "Merchant";
        if (r === "/merchant/roles") return "RoleManager";
        if (r === "/merchant/knowledge" || r === "/admin/knowledge") return "Knowledge";
        if (r === "/merchant/knowledge/debug" || r === "/admin/knowledge/debug")
          return "KnowledgeDebug";
        if ([
          "/merchant",
          "/merchant/inventory",
          "/merchant/orders",
          "/merchant/pickup",
          "/merchant/aftersales",
          "/merchant/team",
          "/merchant/settings"
        ].includes(r))
          return "MerchantOps";
        if ([
          "/admin",
          "/admin/applications",
          "/admin/merchants",
          "/admin/products",
          "/admin/orders",
          "/admin/disputes",
          "/admin/categories"
        ].includes(r))
          return "Platform";
        if (r.startsWith("/product/")) return "ProductDetail";
        if (r.startsWith("/shops/")) return "Shop";
        if (r === "/cart") return "Cart";
        if (r === "/orders" || r.startsWith("/orders/")) return "Orders";
        if (["/account", "/apply", "/invitations"].includes(r)) return "Account";
        if (r === "/ai") return "Guide";
        return r === "/" ? "Home" : "NotFound";
      });
      const ready = /* @__PURE__ */ ref$j(false), contextError = /* @__PURE__ */ ref$j(""), authRequired = /* @__PURE__ */ ref$j(false), loginOpen = /* @__PURE__ */ ref$j(false);
      const backoffice = computed$h(
        () => [
          "Merchant",
          "MerchantOps",
          "Platform",
          "Knowledge",
          "KnowledgeDebug",
          "RoleManager"
        ].includes(current.value)
      );
      let version2 = 0, restoredIdentity = -1, sessionPending;
      async function refresh() {
        const stamp = ++version2;
        ready.value = false;
        contextError.value = "";
        authRequired.value = false;
        try {
          if (!preview) {
            const identity = store.identityVersion;
            if (restoredIdentity !== identity) {
              restoredIdentity = identity;
              sessionPending = loadSession();
            }
            try {
              await sessionPending;
            } catch (e) {
              if (restoredIdentity === identity) restoredIdentity = -1;
              if (backoffice.value) throw e;
            }
          }
          if (stamp !== version2) return;
          if (!preview && backoffice.value && !store.user) {
            authRequired.value = true;
            return;
          }
          if (store.route.startsWith("/merchant")) await loadMerchant({ contextOnly: true });
          else if (!preview && store.route.startsWith("/admin")) {
            const workspace = await api("/workspace");
            if (stamp !== version2) return;
            store.workspace = workspace;
          } else if (preview) await loadPublic();
        } catch (e) {
          if (stamp === version2) {
            if (e.status === 401 || e.code === "A0004") authRequired.value = true;
            else contextError.value = e.message;
          }
        } finally {
          if (stamp === version2) ready.value = true;
        }
      }
      onMounted$d(() => {
        window.addEventListener("hashchange", setRoute);
        refresh();
      });
      onUnmounted$9(() => {
        ++version2;
        window.removeEventListener("hashchange", setRoute);
      });
      watch$e([() => store.route, () => store.identityVersion], refresh);
      return { store, current, ready, contextError, authRequired, loginOpen, refresh };
    },
    render: (() => {
      const { openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, createTextVNode: _createTextVNode, resolveDynamicComponent: _resolveDynamicComponent, createBlock: _createBlock, resolveComponent: _resolveComponent, normalizeClass: _normalizeClass } = Vue;
      return function render2(_ctx, _cache) {
        const _component_AuthDialog = _resolveComponent("AuthDialog");
        return _openBlock(), _createElementBlock(
          "div",
          {
            class: _normalizeClass(["application", { "admin-mode": _ctx.current === "Merchant" || _ctx.current === "MerchantOps" || _ctx.current === "Platform" || _ctx.current === "Knowledge" || _ctx.current === "KnowledgeDebug" || _ctx.current === "RoleManager" }])
          },
          [
            !_ctx.ready ? (_openBlock(), _createElementBlock("div", {
              key: 0,
              class: "inline-loading",
              role: "status"
            }, "正在恢复身份与权限…")) : _ctx.authRequired ? (_openBlock(), _createElementBlock("div", {
              key: 1,
              class: "mobile-empty"
            }, [
              _createElementVNode("h1", null, "请先登录"),
              _createElementVNode("p", null, "登录后继续访问当前后台页面"),
              _createElementVNode("button", {
                class: "teal-button",
                onClick: ($event) => _ctx.loginOpen = true
              }, "登录", 8, ["onClick"])
            ])) : _ctx.contextError ? (_openBlock(), _createElementBlock("div", {
              key: 2,
              class: "inline-error"
            }, [
              _createTextVNode(
                _toDisplayString(_ctx.contextError) + " ",
                1
                /* TEXT */
              ),
              _createElementVNode("button", { onClick: _ctx.refresh }, "重试", 8, ["onClick"])
            ])) : (_openBlock(), _createBlock(_resolveDynamicComponent(_ctx.current), {
              key: _ctx.store.route + ":" + _ctx.store.identityVersion + ":" + _ctx.store.merchantId
            })),
            _ctx.loginOpen ? (_openBlock(), _createBlock(_component_AuthDialog, {
              key: 4,
              onClose: ($event) => _ctx.loginOpen = false
            }, null, 8, ["onClose"])) : _createCommentVNode("v-if", true),
            _ctx.store.toast ? (_openBlock(), _createElementBlock(
              "div",
              {
                key: 5,
                class: "toast",
                role: "status"
              },
              _toDisplayString(_ctx.store.toast),
              1
              /* TEXT */
            )) : _createCommentVNode("v-if", true)
          ],
          2
          /* CLASS */
        );
      };
    })()
  };
  const app = createApp(App);
  app.component("Icon", Icon);
  app.directive("modal", modal);
  app.mount("#app");
})();
