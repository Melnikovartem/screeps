'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

var intToCharMap = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('');

/**
 * Encode an integer in the range of 0 to 63 to a single base 64 digit.
 */
var encode$1 = function (number) {
  if (0 <= number && number < intToCharMap.length) {
    return intToCharMap[number];
  }
  throw new TypeError("Must be between 0 and 63: " + number);
};

/**
 * Decode a single base 64 character code digit to an integer. Returns -1 on
 * failure.
 */
var decode$1 = function (charCode) {
  var bigA = 65;     // 'A'
  var bigZ = 90;     // 'Z'

  var littleA = 97;  // 'a'
  var littleZ = 122; // 'z'

  var zero = 48;     // '0'
  var nine = 57;     // '9'

  var plus = 43;     // '+'
  var slash = 47;    // '/'

  var littleOffset = 26;
  var numberOffset = 52;

  // 0 - 25: ABCDEFGHIJKLMNOPQRSTUVWXYZ
  if (bigA <= charCode && charCode <= bigZ) {
    return (charCode - bigA);
  }

  // 26 - 51: abcdefghijklmnopqrstuvwxyz
  if (littleA <= charCode && charCode <= littleZ) {
    return (charCode - littleA + littleOffset);
  }

  // 52 - 61: 0123456789
  if (zero <= charCode && charCode <= nine) {
    return (charCode - zero + numberOffset);
  }

  // 62: +
  if (charCode == plus) {
    return 62;
  }

  // 63: /
  if (charCode == slash) {
    return 63;
  }

  // Invalid base64 digit.
  return -1;
};

var base64 = {
	encode: encode$1,
	decode: decode$1
};

/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 *
 * Based on the Base 64 VLQ implementation in Closure Compiler:
 * https://code.google.com/p/closure-compiler/source/browse/trunk/src/com/google/debugging/sourcemap/Base64VLQ.java
 *
 * Copyright 2011 The Closure Compiler Authors. All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *  * Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above
 *    copyright notice, this list of conditions and the following
 *    disclaimer in the documentation and/or other materials provided
 *    with the distribution.
 *  * Neither the name of Google Inc. nor the names of its
 *    contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */



// A single base 64 digit can contain 6 bits of data. For the base 64 variable
// length quantities we use in the source map spec, the first bit is the sign,
// the next four bits are the actual value, and the 6th bit is the
// continuation bit. The continuation bit tells us whether there are more
// digits in this value following this digit.
//
//   Continuation
//   |    Sign
//   |    |
//   V    V
//   101011

var VLQ_BASE_SHIFT = 5;

// binary: 100000
var VLQ_BASE = 1 << VLQ_BASE_SHIFT;

// binary: 011111
var VLQ_BASE_MASK = VLQ_BASE - 1;

// binary: 100000
var VLQ_CONTINUATION_BIT = VLQ_BASE;

/**
 * Converts from a two-complement value to a value where the sign bit is
 * placed in the least significant bit.  For example, as decimals:
 *   1 becomes 2 (10 binary), -1 becomes 3 (11 binary)
 *   2 becomes 4 (100 binary), -2 becomes 5 (101 binary)
 */
function toVLQSigned(aValue) {
  return aValue < 0
    ? ((-aValue) << 1) + 1
    : (aValue << 1) + 0;
}

/**
 * Converts to a two-complement value from a value where the sign bit is
 * placed in the least significant bit.  For example, as decimals:
 *   2 (10 binary) becomes 1, 3 (11 binary) becomes -1
 *   4 (100 binary) becomes 2, 5 (101 binary) becomes -2
 */
function fromVLQSigned(aValue) {
  var isNegative = (aValue & 1) === 1;
  var shifted = aValue >> 1;
  return isNegative
    ? -shifted
    : shifted;
}

/**
 * Returns the base 64 VLQ encoded value.
 */
var encode = function base64VLQ_encode(aValue) {
  var encoded = "";
  var digit;

  var vlq = toVLQSigned(aValue);

  do {
    digit = vlq & VLQ_BASE_MASK;
    vlq >>>= VLQ_BASE_SHIFT;
    if (vlq > 0) {
      // There are still more digits in this value, so we must make sure the
      // continuation bit is marked.
      digit |= VLQ_CONTINUATION_BIT;
    }
    encoded += base64.encode(digit);
  } while (vlq > 0);

  return encoded;
};

/**
 * Decodes the next base 64 VLQ value from the given string and returns the
 * value and the rest of the string via the out parameter.
 */
var decode = function base64VLQ_decode(aStr, aIndex, aOutParam) {
  var strLen = aStr.length;
  var result = 0;
  var shift = 0;
  var continuation, digit;

  do {
    if (aIndex >= strLen) {
      throw new Error("Expected more digits in base 64 VLQ value.");
    }

    digit = base64.decode(aStr.charCodeAt(aIndex++));
    if (digit === -1) {
      throw new Error("Invalid base64 digit: " + aStr.charAt(aIndex - 1));
    }

    continuation = !!(digit & VLQ_CONTINUATION_BIT);
    digit &= VLQ_BASE_MASK;
    result = result + (digit << shift);
    shift += VLQ_BASE_SHIFT;
  } while (continuation);

  aOutParam.value = fromVLQSigned(result);
  aOutParam.rest = aIndex;
};

var base64Vlq = {
	encode: encode,
	decode: decode
};

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var util = createCommonjsModule(function (module, exports) {
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

/**
 * This is a helper function for getting values from parameter/options
 * objects.
 *
 * @param args The object we are extracting values from
 * @param name The name of the property we are getting.
 * @param defaultValue An optional value to return if the property is missing
 * from the object. If this is not specified and the property is missing, an
 * error will be thrown.
 */
function getArg(aArgs, aName, aDefaultValue) {
  if (aName in aArgs) {
    return aArgs[aName];
  } else if (arguments.length === 3) {
    return aDefaultValue;
  } else {
    throw new Error('"' + aName + '" is a required argument.');
  }
}
exports.getArg = getArg;

var urlRegexp = /^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.-]*)(?::(\d+))?(.*)$/;
var dataUrlRegexp = /^data:.+\,.+$/;

function urlParse(aUrl) {
  var match = aUrl.match(urlRegexp);
  if (!match) {
    return null;
  }
  return {
    scheme: match[1],
    auth: match[2],
    host: match[3],
    port: match[4],
    path: match[5]
  };
}
exports.urlParse = urlParse;

function urlGenerate(aParsedUrl) {
  var url = '';
  if (aParsedUrl.scheme) {
    url += aParsedUrl.scheme + ':';
  }
  url += '//';
  if (aParsedUrl.auth) {
    url += aParsedUrl.auth + '@';
  }
  if (aParsedUrl.host) {
    url += aParsedUrl.host;
  }
  if (aParsedUrl.port) {
    url += ":" + aParsedUrl.port;
  }
  if (aParsedUrl.path) {
    url += aParsedUrl.path;
  }
  return url;
}
exports.urlGenerate = urlGenerate;

/**
 * Normalizes a path, or the path portion of a URL:
 *
 * - Replaces consecutive slashes with one slash.
 * - Removes unnecessary '.' parts.
 * - Removes unnecessary '<dir>/..' parts.
 *
 * Based on code in the Node.js 'path' core module.
 *
 * @param aPath The path or url to normalize.
 */
function normalize(aPath) {
  var path = aPath;
  var url = urlParse(aPath);
  if (url) {
    if (!url.path) {
      return aPath;
    }
    path = url.path;
  }
  var isAbsolute = exports.isAbsolute(path);

  var parts = path.split(/\/+/);
  for (var part, up = 0, i = parts.length - 1; i >= 0; i--) {
    part = parts[i];
    if (part === '.') {
      parts.splice(i, 1);
    } else if (part === '..') {
      up++;
    } else if (up > 0) {
      if (part === '') {
        // The first part is blank if the path is absolute. Trying to go
        // above the root is a no-op. Therefore we can remove all '..' parts
        // directly after the root.
        parts.splice(i + 1, up);
        up = 0;
      } else {
        parts.splice(i, 2);
        up--;
      }
    }
  }
  path = parts.join('/');

  if (path === '') {
    path = isAbsolute ? '/' : '.';
  }

  if (url) {
    url.path = path;
    return urlGenerate(url);
  }
  return path;
}
exports.normalize = normalize;

/**
 * Joins two paths/URLs.
 *
 * @param aRoot The root path or URL.
 * @param aPath The path or URL to be joined with the root.
 *
 * - If aPath is a URL or a data URI, aPath is returned, unless aPath is a
 *   scheme-relative URL: Then the scheme of aRoot, if any, is prepended
 *   first.
 * - Otherwise aPath is a path. If aRoot is a URL, then its path portion
 *   is updated with the result and aRoot is returned. Otherwise the result
 *   is returned.
 *   - If aPath is absolute, the result is aPath.
 *   - Otherwise the two paths are joined with a slash.
 * - Joining for example 'http://' and 'www.example.com' is also supported.
 */
function join(aRoot, aPath) {
  if (aRoot === "") {
    aRoot = ".";
  }
  if (aPath === "") {
    aPath = ".";
  }
  var aPathUrl = urlParse(aPath);
  var aRootUrl = urlParse(aRoot);
  if (aRootUrl) {
    aRoot = aRootUrl.path || '/';
  }

  // `join(foo, '//www.example.org')`
  if (aPathUrl && !aPathUrl.scheme) {
    if (aRootUrl) {
      aPathUrl.scheme = aRootUrl.scheme;
    }
    return urlGenerate(aPathUrl);
  }

  if (aPathUrl || aPath.match(dataUrlRegexp)) {
    return aPath;
  }

  // `join('http://', 'www.example.com')`
  if (aRootUrl && !aRootUrl.host && !aRootUrl.path) {
    aRootUrl.host = aPath;
    return urlGenerate(aRootUrl);
  }

  var joined = aPath.charAt(0) === '/'
    ? aPath
    : normalize(aRoot.replace(/\/+$/, '') + '/' + aPath);

  if (aRootUrl) {
    aRootUrl.path = joined;
    return urlGenerate(aRootUrl);
  }
  return joined;
}
exports.join = join;

exports.isAbsolute = function (aPath) {
  return aPath.charAt(0) === '/' || urlRegexp.test(aPath);
};

/**
 * Make a path relative to a URL or another path.
 *
 * @param aRoot The root path or URL.
 * @param aPath The path or URL to be made relative to aRoot.
 */
function relative(aRoot, aPath) {
  if (aRoot === "") {
    aRoot = ".";
  }

  aRoot = aRoot.replace(/\/$/, '');

  // It is possible for the path to be above the root. In this case, simply
  // checking whether the root is a prefix of the path won't work. Instead, we
  // need to remove components from the root one by one, until either we find
  // a prefix that fits, or we run out of components to remove.
  var level = 0;
  while (aPath.indexOf(aRoot + '/') !== 0) {
    var index = aRoot.lastIndexOf("/");
    if (index < 0) {
      return aPath;
    }

    // If the only part of the root that is left is the scheme (i.e. http://,
    // file:///, etc.), one or more slashes (/), or simply nothing at all, we
    // have exhausted all components, so the path is not relative to the root.
    aRoot = aRoot.slice(0, index);
    if (aRoot.match(/^([^\/]+:\/)?\/*$/)) {
      return aPath;
    }

    ++level;
  }

  // Make sure we add a "../" for each component we removed from the root.
  return Array(level + 1).join("../") + aPath.substr(aRoot.length + 1);
}
exports.relative = relative;

var supportsNullProto = (function () {
  var obj = Object.create(null);
  return !('__proto__' in obj);
}());

function identity (s) {
  return s;
}

/**
 * Because behavior goes wacky when you set `__proto__` on objects, we
 * have to prefix all the strings in our set with an arbitrary character.
 *
 * See https://github.com/mozilla/source-map/pull/31 and
 * https://github.com/mozilla/source-map/issues/30
 *
 * @param String aStr
 */
function toSetString(aStr) {
  if (isProtoString(aStr)) {
    return '$' + aStr;
  }

  return aStr;
}
exports.toSetString = supportsNullProto ? identity : toSetString;

function fromSetString(aStr) {
  if (isProtoString(aStr)) {
    return aStr.slice(1);
  }

  return aStr;
}
exports.fromSetString = supportsNullProto ? identity : fromSetString;

function isProtoString(s) {
  if (!s) {
    return false;
  }

  var length = s.length;

  if (length < 9 /* "__proto__".length */) {
    return false;
  }

  if (s.charCodeAt(length - 1) !== 95  /* '_' */ ||
      s.charCodeAt(length - 2) !== 95  /* '_' */ ||
      s.charCodeAt(length - 3) !== 111 /* 'o' */ ||
      s.charCodeAt(length - 4) !== 116 /* 't' */ ||
      s.charCodeAt(length - 5) !== 111 /* 'o' */ ||
      s.charCodeAt(length - 6) !== 114 /* 'r' */ ||
      s.charCodeAt(length - 7) !== 112 /* 'p' */ ||
      s.charCodeAt(length - 8) !== 95  /* '_' */ ||
      s.charCodeAt(length - 9) !== 95  /* '_' */) {
    return false;
  }

  for (var i = length - 10; i >= 0; i--) {
    if (s.charCodeAt(i) !== 36 /* '$' */) {
      return false;
    }
  }

  return true;
}

/**
 * Comparator between two mappings where the original positions are compared.
 *
 * Optionally pass in `true` as `onlyCompareGenerated` to consider two
 * mappings with the same original source/line/column, but different generated
 * line and column the same. Useful when searching for a mapping with a
 * stubbed out mapping.
 */
function compareByOriginalPositions(mappingA, mappingB, onlyCompareOriginal) {
  var cmp = strcmp(mappingA.source, mappingB.source);
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.originalLine - mappingB.originalLine;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.originalColumn - mappingB.originalColumn;
  if (cmp !== 0 || onlyCompareOriginal) {
    return cmp;
  }

  cmp = mappingA.generatedColumn - mappingB.generatedColumn;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.generatedLine - mappingB.generatedLine;
  if (cmp !== 0) {
    return cmp;
  }

  return strcmp(mappingA.name, mappingB.name);
}
exports.compareByOriginalPositions = compareByOriginalPositions;

/**
 * Comparator between two mappings with deflated source and name indices where
 * the generated positions are compared.
 *
 * Optionally pass in `true` as `onlyCompareGenerated` to consider two
 * mappings with the same generated line and column, but different
 * source/name/original line and column the same. Useful when searching for a
 * mapping with a stubbed out mapping.
 */
function compareByGeneratedPositionsDeflated(mappingA, mappingB, onlyCompareGenerated) {
  var cmp = mappingA.generatedLine - mappingB.generatedLine;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.generatedColumn - mappingB.generatedColumn;
  if (cmp !== 0 || onlyCompareGenerated) {
    return cmp;
  }

  cmp = strcmp(mappingA.source, mappingB.source);
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.originalLine - mappingB.originalLine;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.originalColumn - mappingB.originalColumn;
  if (cmp !== 0) {
    return cmp;
  }

  return strcmp(mappingA.name, mappingB.name);
}
exports.compareByGeneratedPositionsDeflated = compareByGeneratedPositionsDeflated;

function strcmp(aStr1, aStr2) {
  if (aStr1 === aStr2) {
    return 0;
  }

  if (aStr1 === null) {
    return 1; // aStr2 !== null
  }

  if (aStr2 === null) {
    return -1; // aStr1 !== null
  }

  if (aStr1 > aStr2) {
    return 1;
  }

  return -1;
}

/**
 * Comparator between two mappings with inflated source and name strings where
 * the generated positions are compared.
 */
function compareByGeneratedPositionsInflated(mappingA, mappingB) {
  var cmp = mappingA.generatedLine - mappingB.generatedLine;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.generatedColumn - mappingB.generatedColumn;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = strcmp(mappingA.source, mappingB.source);
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.originalLine - mappingB.originalLine;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.originalColumn - mappingB.originalColumn;
  if (cmp !== 0) {
    return cmp;
  }

  return strcmp(mappingA.name, mappingB.name);
}
exports.compareByGeneratedPositionsInflated = compareByGeneratedPositionsInflated;

/**
 * Strip any JSON XSSI avoidance prefix from the string (as documented
 * in the source maps specification), and then parse the string as
 * JSON.
 */
function parseSourceMapInput(str) {
  return JSON.parse(str.replace(/^\)]}'[^\n]*\n/, ''));
}
exports.parseSourceMapInput = parseSourceMapInput;

/**
 * Compute the URL of a source given the the source root, the source's
 * URL, and the source map's URL.
 */
function computeSourceURL(sourceRoot, sourceURL, sourceMapURL) {
  sourceURL = sourceURL || '';

  if (sourceRoot) {
    // This follows what Chrome does.
    if (sourceRoot[sourceRoot.length - 1] !== '/' && sourceURL[0] !== '/') {
      sourceRoot += '/';
    }
    // The spec says:
    //   Line 4: An optional source root, useful for relocating source
    //   files on a server or removing repeated values in the
    //   “sources” entry.  This value is prepended to the individual
    //   entries in the “source” field.
    sourceURL = sourceRoot + sourceURL;
  }

  // Historically, SourceMapConsumer did not take the sourceMapURL as
  // a parameter.  This mode is still somewhat supported, which is why
  // this code block is conditional.  However, it's preferable to pass
  // the source map URL to SourceMapConsumer, so that this function
  // can implement the source URL resolution algorithm as outlined in
  // the spec.  This block is basically the equivalent of:
  //    new URL(sourceURL, sourceMapURL).toString()
  // ... except it avoids using URL, which wasn't available in the
  // older releases of node still supported by this library.
  //
  // The spec says:
  //   If the sources are not absolute URLs after prepending of the
  //   “sourceRoot”, the sources are resolved relative to the
  //   SourceMap (like resolving script src in a html document).
  if (sourceMapURL) {
    var parsed = urlParse(sourceMapURL);
    if (!parsed) {
      throw new Error("sourceMapURL could not be parsed");
    }
    if (parsed.path) {
      // Strip the last path component, but keep the "/".
      var index = parsed.path.lastIndexOf('/');
      if (index >= 0) {
        parsed.path = parsed.path.substring(0, index + 1);
      }
    }
    sourceURL = join(urlGenerate(parsed), sourceURL);
  }

  return normalize(sourceURL);
}
exports.computeSourceURL = computeSourceURL;
});
util.getArg;
util.urlParse;
util.urlGenerate;
util.normalize;
util.join;
util.isAbsolute;
util.relative;
util.toSetString;
util.fromSetString;
util.compareByOriginalPositions;
util.compareByGeneratedPositionsDeflated;
util.compareByGeneratedPositionsInflated;
util.parseSourceMapInput;
util.computeSourceURL;

/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */


var has = Object.prototype.hasOwnProperty;
var hasNativeMap = typeof Map !== "undefined";

/**
 * A data structure which is a combination of an array and a set. Adding a new
 * member is O(1), testing for membership is O(1), and finding the index of an
 * element is O(1). Removing elements from the set is not supported. Only
 * strings are supported for membership.
 */
function ArraySet$1() {
  this._array = [];
  this._set = hasNativeMap ? new Map() : Object.create(null);
}

/**
 * Static method for creating ArraySet instances from an existing array.
 */
ArraySet$1.fromArray = function ArraySet_fromArray(aArray, aAllowDuplicates) {
  var set = new ArraySet$1();
  for (var i = 0, len = aArray.length; i < len; i++) {
    set.add(aArray[i], aAllowDuplicates);
  }
  return set;
};

/**
 * Return how many unique items are in this ArraySet. If duplicates have been
 * added, than those do not count towards the size.
 *
 * @returns Number
 */
ArraySet$1.prototype.size = function ArraySet_size() {
  return hasNativeMap ? this._set.size : Object.getOwnPropertyNames(this._set).length;
};

/**
 * Add the given string to this set.
 *
 * @param String aStr
 */
ArraySet$1.prototype.add = function ArraySet_add(aStr, aAllowDuplicates) {
  var sStr = hasNativeMap ? aStr : util.toSetString(aStr);
  var isDuplicate = hasNativeMap ? this.has(aStr) : has.call(this._set, sStr);
  var idx = this._array.length;
  if (!isDuplicate || aAllowDuplicates) {
    this._array.push(aStr);
  }
  if (!isDuplicate) {
    if (hasNativeMap) {
      this._set.set(aStr, idx);
    } else {
      this._set[sStr] = idx;
    }
  }
};

/**
 * Is the given string a member of this set?
 *
 * @param String aStr
 */
ArraySet$1.prototype.has = function ArraySet_has(aStr) {
  if (hasNativeMap) {
    return this._set.has(aStr);
  } else {
    var sStr = util.toSetString(aStr);
    return has.call(this._set, sStr);
  }
};

/**
 * What is the index of the given string in the array?
 *
 * @param String aStr
 */
ArraySet$1.prototype.indexOf = function ArraySet_indexOf(aStr) {
  if (hasNativeMap) {
    var idx = this._set.get(aStr);
    if (idx >= 0) {
        return idx;
    }
  } else {
    var sStr = util.toSetString(aStr);
    if (has.call(this._set, sStr)) {
      return this._set[sStr];
    }
  }

  throw new Error('"' + aStr + '" is not in the set.');
};

/**
 * What is the element at the given index?
 *
 * @param Number aIdx
 */
ArraySet$1.prototype.at = function ArraySet_at(aIdx) {
  if (aIdx >= 0 && aIdx < this._array.length) {
    return this._array[aIdx];
  }
  throw new Error('No element indexed by ' + aIdx);
};

/**
 * Returns the array representation of this set (which has the proper indices
 * indicated by indexOf). Note that this is a copy of the internal array used
 * for storing the members so that no one can mess with internal state.
 */
ArraySet$1.prototype.toArray = function ArraySet_toArray() {
  return this._array.slice();
};

var ArraySet_1 = ArraySet$1;

var arraySet = {
	ArraySet: ArraySet_1
};

var binarySearch = createCommonjsModule(function (module, exports) {
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

exports.GREATEST_LOWER_BOUND = 1;
exports.LEAST_UPPER_BOUND = 2;

/**
 * Recursive implementation of binary search.
 *
 * @param aLow Indices here and lower do not contain the needle.
 * @param aHigh Indices here and higher do not contain the needle.
 * @param aNeedle The element being searched for.
 * @param aHaystack The non-empty array being searched.
 * @param aCompare Function which takes two elements and returns -1, 0, or 1.
 * @param aBias Either 'binarySearch.GREATEST_LOWER_BOUND' or
 *     'binarySearch.LEAST_UPPER_BOUND'. Specifies whether to return the
 *     closest element that is smaller than or greater than the one we are
 *     searching for, respectively, if the exact element cannot be found.
 */
function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare, aBias) {
  // This function terminates when one of the following is true:
  //
  //   1. We find the exact element we are looking for.
  //
  //   2. We did not find the exact element, but we can return the index of
  //      the next-closest element.
  //
  //   3. We did not find the exact element, and there is no next-closest
  //      element than the one we are searching for, so we return -1.
  var mid = Math.floor((aHigh - aLow) / 2) + aLow;
  var cmp = aCompare(aNeedle, aHaystack[mid], true);
  if (cmp === 0) {
    // Found the element we are looking for.
    return mid;
  }
  else if (cmp > 0) {
    // Our needle is greater than aHaystack[mid].
    if (aHigh - mid > 1) {
      // The element is in the upper half.
      return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare, aBias);
    }

    // The exact needle element was not found in this haystack. Determine if
    // we are in termination case (3) or (2) and return the appropriate thing.
    if (aBias == exports.LEAST_UPPER_BOUND) {
      return aHigh < aHaystack.length ? aHigh : -1;
    } else {
      return mid;
    }
  }
  else {
    // Our needle is less than aHaystack[mid].
    if (mid - aLow > 1) {
      // The element is in the lower half.
      return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare, aBias);
    }

    // we are in termination case (3) or (2) and return the appropriate thing.
    if (aBias == exports.LEAST_UPPER_BOUND) {
      return mid;
    } else {
      return aLow < 0 ? -1 : aLow;
    }
  }
}

/**
 * This is an implementation of binary search which will always try and return
 * the index of the closest element if there is no exact hit. This is because
 * mappings between original and generated line/col pairs are single points,
 * and there is an implicit region between each of them, so a miss just means
 * that you aren't on the very start of a region.
 *
 * @param aNeedle The element you are looking for.
 * @param aHaystack The array that is being searched.
 * @param aCompare A function which takes the needle and an element in the
 *     array and returns -1, 0, or 1 depending on whether the needle is less
 *     than, equal to, or greater than the element, respectively.
 * @param aBias Either 'binarySearch.GREATEST_LOWER_BOUND' or
 *     'binarySearch.LEAST_UPPER_BOUND'. Specifies whether to return the
 *     closest element that is smaller than or greater than the one we are
 *     searching for, respectively, if the exact element cannot be found.
 *     Defaults to 'binarySearch.GREATEST_LOWER_BOUND'.
 */
exports.search = function search(aNeedle, aHaystack, aCompare, aBias) {
  if (aHaystack.length === 0) {
    return -1;
  }

  var index = recursiveSearch(-1, aHaystack.length, aNeedle, aHaystack,
                              aCompare, aBias || exports.GREATEST_LOWER_BOUND);
  if (index < 0) {
    return -1;
  }

  // We have found either the exact element, or the next-closest element than
  // the one we are searching for. However, there may be more than one such
  // element. Make sure we always return the smallest of these.
  while (index - 1 >= 0) {
    if (aCompare(aHaystack[index], aHaystack[index - 1], true) !== 0) {
      break;
    }
    --index;
  }

  return index;
};
});
binarySearch.GREATEST_LOWER_BOUND;
binarySearch.LEAST_UPPER_BOUND;
binarySearch.search;

/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

// It turns out that some (most?) JavaScript engines don't self-host
// `Array.prototype.sort`. This makes sense because C++ will likely remain
// faster than JS when doing raw CPU-intensive sorting. However, when using a
// custom comparator function, calling back and forth between the VM's C++ and
// JIT'd JS is rather slow *and* loses JIT type information, resulting in
// worse generated code for the comparator function than would be optimal. In
// fact, when sorting with a comparator, these costs outweigh the benefits of
// sorting in C++. By using our own JS-implemented Quick Sort (below), we get
// a ~3500ms mean speed-up in `bench/bench.html`.

/**
 * Swap the elements indexed by `x` and `y` in the array `ary`.
 *
 * @param {Array} ary
 *        The array.
 * @param {Number} x
 *        The index of the first item.
 * @param {Number} y
 *        The index of the second item.
 */
function swap(ary, x, y) {
  var temp = ary[x];
  ary[x] = ary[y];
  ary[y] = temp;
}

/**
 * Returns a random integer within the range `low .. high` inclusive.
 *
 * @param {Number} low
 *        The lower bound on the range.
 * @param {Number} high
 *        The upper bound on the range.
 */
function randomIntInRange(low, high) {
  return Math.round(low + (Math.random() * (high - low)));
}

/**
 * The Quick Sort algorithm.
 *
 * @param {Array} ary
 *        An array to sort.
 * @param {function} comparator
 *        Function to use to compare two items.
 * @param {Number} p
 *        Start index of the array
 * @param {Number} r
 *        End index of the array
 */
function doQuickSort(ary, comparator, p, r) {
  // If our lower bound is less than our upper bound, we (1) partition the
  // array into two pieces and (2) recurse on each half. If it is not, this is
  // the empty array and our base case.

  if (p < r) {
    // (1) Partitioning.
    //
    // The partitioning chooses a pivot between `p` and `r` and moves all
    // elements that are less than or equal to the pivot to the before it, and
    // all the elements that are greater than it after it. The effect is that
    // once partition is done, the pivot is in the exact place it will be when
    // the array is put in sorted order, and it will not need to be moved
    // again. This runs in O(n) time.

    // Always choose a random pivot so that an input array which is reverse
    // sorted does not cause O(n^2) running time.
    var pivotIndex = randomIntInRange(p, r);
    var i = p - 1;

    swap(ary, pivotIndex, r);
    var pivot = ary[r];

    // Immediately after `j` is incremented in this loop, the following hold
    // true:
    //
    //   * Every element in `ary[p .. i]` is less than or equal to the pivot.
    //
    //   * Every element in `ary[i+1 .. j-1]` is greater than the pivot.
    for (var j = p; j < r; j++) {
      if (comparator(ary[j], pivot) <= 0) {
        i += 1;
        swap(ary, i, j);
      }
    }

    swap(ary, i + 1, j);
    var q = i + 1;

    // (2) Recurse on each half.

    doQuickSort(ary, comparator, p, q - 1);
    doQuickSort(ary, comparator, q + 1, r);
  }
}

/**
 * Sort the given array in-place with the given comparator function.
 *
 * @param {Array} ary
 *        An array to sort.
 * @param {function} comparator
 *        Function to use to compare two items.
 */
var quickSort_1 = function (ary, comparator) {
  doQuickSort(ary, comparator, 0, ary.length - 1);
};

var quickSort$1 = {
	quickSort: quickSort_1
};

/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */



var ArraySet = arraySet.ArraySet;

var quickSort = quickSort$1.quickSort;

function SourceMapConsumer$1(aSourceMap, aSourceMapURL) {
  var sourceMap = aSourceMap;
  if (typeof aSourceMap === 'string') {
    sourceMap = util.parseSourceMapInput(aSourceMap);
  }

  return sourceMap.sections != null
    ? new IndexedSourceMapConsumer(sourceMap, aSourceMapURL)
    : new BasicSourceMapConsumer(sourceMap, aSourceMapURL);
}

SourceMapConsumer$1.fromSourceMap = function(aSourceMap, aSourceMapURL) {
  return BasicSourceMapConsumer.fromSourceMap(aSourceMap, aSourceMapURL);
};

/**
 * The version of the source mapping spec that we are consuming.
 */
SourceMapConsumer$1.prototype._version = 3;

// `__generatedMappings` and `__originalMappings` are arrays that hold the
// parsed mapping coordinates from the source map's "mappings" attribute. They
// are lazily instantiated, accessed via the `_generatedMappings` and
// `_originalMappings` getters respectively, and we only parse the mappings
// and create these arrays once queried for a source location. We jump through
// these hoops because there can be many thousands of mappings, and parsing
// them is expensive, so we only want to do it if we must.
//
// Each object in the arrays is of the form:
//
//     {
//       generatedLine: The line number in the generated code,
//       generatedColumn: The column number in the generated code,
//       source: The path to the original source file that generated this
//               chunk of code,
//       originalLine: The line number in the original source that
//                     corresponds to this chunk of generated code,
//       originalColumn: The column number in the original source that
//                       corresponds to this chunk of generated code,
//       name: The name of the original symbol which generated this chunk of
//             code.
//     }
//
// All properties except for `generatedLine` and `generatedColumn` can be
// `null`.
//
// `_generatedMappings` is ordered by the generated positions.
//
// `_originalMappings` is ordered by the original positions.

SourceMapConsumer$1.prototype.__generatedMappings = null;
Object.defineProperty(SourceMapConsumer$1.prototype, '_generatedMappings', {
  configurable: true,
  enumerable: true,
  get: function () {
    if (!this.__generatedMappings) {
      this._parseMappings(this._mappings, this.sourceRoot);
    }

    return this.__generatedMappings;
  }
});

SourceMapConsumer$1.prototype.__originalMappings = null;
Object.defineProperty(SourceMapConsumer$1.prototype, '_originalMappings', {
  configurable: true,
  enumerable: true,
  get: function () {
    if (!this.__originalMappings) {
      this._parseMappings(this._mappings, this.sourceRoot);
    }

    return this.__originalMappings;
  }
});

SourceMapConsumer$1.prototype._charIsMappingSeparator =
  function SourceMapConsumer_charIsMappingSeparator(aStr, index) {
    var c = aStr.charAt(index);
    return c === ";" || c === ",";
  };

/**
 * Parse the mappings in a string in to a data structure which we can easily
 * query (the ordered arrays in the `this.__generatedMappings` and
 * `this.__originalMappings` properties).
 */
SourceMapConsumer$1.prototype._parseMappings =
  function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
    throw new Error("Subclasses must implement _parseMappings");
  };

SourceMapConsumer$1.GENERATED_ORDER = 1;
SourceMapConsumer$1.ORIGINAL_ORDER = 2;

SourceMapConsumer$1.GREATEST_LOWER_BOUND = 1;
SourceMapConsumer$1.LEAST_UPPER_BOUND = 2;

/**
 * Iterate over each mapping between an original source/line/column and a
 * generated line/column in this source map.
 *
 * @param Function aCallback
 *        The function that is called with each mapping.
 * @param Object aContext
 *        Optional. If specified, this object will be the value of `this` every
 *        time that `aCallback` is called.
 * @param aOrder
 *        Either `SourceMapConsumer.GENERATED_ORDER` or
 *        `SourceMapConsumer.ORIGINAL_ORDER`. Specifies whether you want to
 *        iterate over the mappings sorted by the generated file's line/column
 *        order or the original's source/line/column order, respectively. Defaults to
 *        `SourceMapConsumer.GENERATED_ORDER`.
 */
SourceMapConsumer$1.prototype.eachMapping =
  function SourceMapConsumer_eachMapping(aCallback, aContext, aOrder) {
    var context = aContext || null;
    var order = aOrder || SourceMapConsumer$1.GENERATED_ORDER;

    var mappings;
    switch (order) {
    case SourceMapConsumer$1.GENERATED_ORDER:
      mappings = this._generatedMappings;
      break;
    case SourceMapConsumer$1.ORIGINAL_ORDER:
      mappings = this._originalMappings;
      break;
    default:
      throw new Error("Unknown order of iteration.");
    }

    var sourceRoot = this.sourceRoot;
    mappings.map(function (mapping) {
      var source = mapping.source === null ? null : this._sources.at(mapping.source);
      source = util.computeSourceURL(sourceRoot, source, this._sourceMapURL);
      return {
        source: source,
        generatedLine: mapping.generatedLine,
        generatedColumn: mapping.generatedColumn,
        originalLine: mapping.originalLine,
        originalColumn: mapping.originalColumn,
        name: mapping.name === null ? null : this._names.at(mapping.name)
      };
    }, this).forEach(aCallback, context);
  };

/**
 * Returns all generated line and column information for the original source,
 * line, and column provided. If no column is provided, returns all mappings
 * corresponding to a either the line we are searching for or the next
 * closest line that has any mappings. Otherwise, returns all mappings
 * corresponding to the given line and either the column we are searching for
 * or the next closest column that has any offsets.
 *
 * The only argument is an object with the following properties:
 *
 *   - source: The filename of the original source.
 *   - line: The line number in the original source.  The line number is 1-based.
 *   - column: Optional. the column number in the original source.
 *    The column number is 0-based.
 *
 * and an array of objects is returned, each with the following properties:
 *
 *   - line: The line number in the generated source, or null.  The
 *    line number is 1-based.
 *   - column: The column number in the generated source, or null.
 *    The column number is 0-based.
 */
SourceMapConsumer$1.prototype.allGeneratedPositionsFor =
  function SourceMapConsumer_allGeneratedPositionsFor(aArgs) {
    var line = util.getArg(aArgs, 'line');

    // When there is no exact match, BasicSourceMapConsumer.prototype._findMapping
    // returns the index of the closest mapping less than the needle. By
    // setting needle.originalColumn to 0, we thus find the last mapping for
    // the given line, provided such a mapping exists.
    var needle = {
      source: util.getArg(aArgs, 'source'),
      originalLine: line,
      originalColumn: util.getArg(aArgs, 'column', 0)
    };

    needle.source = this._findSourceIndex(needle.source);
    if (needle.source < 0) {
      return [];
    }

    var mappings = [];

    var index = this._findMapping(needle,
                                  this._originalMappings,
                                  "originalLine",
                                  "originalColumn",
                                  util.compareByOriginalPositions,
                                  binarySearch.LEAST_UPPER_BOUND);
    if (index >= 0) {
      var mapping = this._originalMappings[index];

      if (aArgs.column === undefined) {
        var originalLine = mapping.originalLine;

        // Iterate until either we run out of mappings, or we run into
        // a mapping for a different line than the one we found. Since
        // mappings are sorted, this is guaranteed to find all mappings for
        // the line we found.
        while (mapping && mapping.originalLine === originalLine) {
          mappings.push({
            line: util.getArg(mapping, 'generatedLine', null),
            column: util.getArg(mapping, 'generatedColumn', null),
            lastColumn: util.getArg(mapping, 'lastGeneratedColumn', null)
          });

          mapping = this._originalMappings[++index];
        }
      } else {
        var originalColumn = mapping.originalColumn;

        // Iterate until either we run out of mappings, or we run into
        // a mapping for a different line than the one we were searching for.
        // Since mappings are sorted, this is guaranteed to find all mappings for
        // the line we are searching for.
        while (mapping &&
               mapping.originalLine === line &&
               mapping.originalColumn == originalColumn) {
          mappings.push({
            line: util.getArg(mapping, 'generatedLine', null),
            column: util.getArg(mapping, 'generatedColumn', null),
            lastColumn: util.getArg(mapping, 'lastGeneratedColumn', null)
          });

          mapping = this._originalMappings[++index];
        }
      }
    }

    return mappings;
  };

var SourceMapConsumer_1 = SourceMapConsumer$1;

/**
 * A BasicSourceMapConsumer instance represents a parsed source map which we can
 * query for information about the original file positions by giving it a file
 * position in the generated source.
 *
 * The first parameter is the raw source map (either as a JSON string, or
 * already parsed to an object). According to the spec, source maps have the
 * following attributes:
 *
 *   - version: Which version of the source map spec this map is following.
 *   - sources: An array of URLs to the original source files.
 *   - names: An array of identifiers which can be referrenced by individual mappings.
 *   - sourceRoot: Optional. The URL root from which all sources are relative.
 *   - sourcesContent: Optional. An array of contents of the original source files.
 *   - mappings: A string of base64 VLQs which contain the actual mappings.
 *   - file: Optional. The generated file this source map is associated with.
 *
 * Here is an example source map, taken from the source map spec[0]:
 *
 *     {
 *       version : 3,
 *       file: "out.js",
 *       sourceRoot : "",
 *       sources: ["foo.js", "bar.js"],
 *       names: ["src", "maps", "are", "fun"],
 *       mappings: "AA,AB;;ABCDE;"
 *     }
 *
 * The second parameter, if given, is a string whose value is the URL
 * at which the source map was found.  This URL is used to compute the
 * sources array.
 *
 * [0]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit?pli=1#
 */
function BasicSourceMapConsumer(aSourceMap, aSourceMapURL) {
  var sourceMap = aSourceMap;
  if (typeof aSourceMap === 'string') {
    sourceMap = util.parseSourceMapInput(aSourceMap);
  }

  var version = util.getArg(sourceMap, 'version');
  var sources = util.getArg(sourceMap, 'sources');
  // Sass 3.3 leaves out the 'names' array, so we deviate from the spec (which
  // requires the array) to play nice here.
  var names = util.getArg(sourceMap, 'names', []);
  var sourceRoot = util.getArg(sourceMap, 'sourceRoot', null);
  var sourcesContent = util.getArg(sourceMap, 'sourcesContent', null);
  var mappings = util.getArg(sourceMap, 'mappings');
  var file = util.getArg(sourceMap, 'file', null);

  // Once again, Sass deviates from the spec and supplies the version as a
  // string rather than a number, so we use loose equality checking here.
  if (version != this._version) {
    throw new Error('Unsupported version: ' + version);
  }

  if (sourceRoot) {
    sourceRoot = util.normalize(sourceRoot);
  }

  sources = sources
    .map(String)
    // Some source maps produce relative source paths like "./foo.js" instead of
    // "foo.js".  Normalize these first so that future comparisons will succeed.
    // See bugzil.la/1090768.
    .map(util.normalize)
    // Always ensure that absolute sources are internally stored relative to
    // the source root, if the source root is absolute. Not doing this would
    // be particularly problematic when the source root is a prefix of the
    // source (valid, but why??). See github issue #199 and bugzil.la/1188982.
    .map(function (source) {
      return sourceRoot && util.isAbsolute(sourceRoot) && util.isAbsolute(source)
        ? util.relative(sourceRoot, source)
        : source;
    });

  // Pass `true` below to allow duplicate names and sources. While source maps
  // are intended to be compressed and deduplicated, the TypeScript compiler
  // sometimes generates source maps with duplicates in them. See Github issue
  // #72 and bugzil.la/889492.
  this._names = ArraySet.fromArray(names.map(String), true);
  this._sources = ArraySet.fromArray(sources, true);

  this._absoluteSources = this._sources.toArray().map(function (s) {
    return util.computeSourceURL(sourceRoot, s, aSourceMapURL);
  });

  this.sourceRoot = sourceRoot;
  this.sourcesContent = sourcesContent;
  this._mappings = mappings;
  this._sourceMapURL = aSourceMapURL;
  this.file = file;
}

BasicSourceMapConsumer.prototype = Object.create(SourceMapConsumer$1.prototype);
BasicSourceMapConsumer.prototype.consumer = SourceMapConsumer$1;

/**
 * Utility function to find the index of a source.  Returns -1 if not
 * found.
 */
BasicSourceMapConsumer.prototype._findSourceIndex = function(aSource) {
  var relativeSource = aSource;
  if (this.sourceRoot != null) {
    relativeSource = util.relative(this.sourceRoot, relativeSource);
  }

  if (this._sources.has(relativeSource)) {
    return this._sources.indexOf(relativeSource);
  }

  // Maybe aSource is an absolute URL as returned by |sources|.  In
  // this case we can't simply undo the transform.
  var i;
  for (i = 0; i < this._absoluteSources.length; ++i) {
    if (this._absoluteSources[i] == aSource) {
      return i;
    }
  }

  return -1;
};

/**
 * Create a BasicSourceMapConsumer from a SourceMapGenerator.
 *
 * @param SourceMapGenerator aSourceMap
 *        The source map that will be consumed.
 * @param String aSourceMapURL
 *        The URL at which the source map can be found (optional)
 * @returns BasicSourceMapConsumer
 */
BasicSourceMapConsumer.fromSourceMap =
  function SourceMapConsumer_fromSourceMap(aSourceMap, aSourceMapURL) {
    var smc = Object.create(BasicSourceMapConsumer.prototype);

    var names = smc._names = ArraySet.fromArray(aSourceMap._names.toArray(), true);
    var sources = smc._sources = ArraySet.fromArray(aSourceMap._sources.toArray(), true);
    smc.sourceRoot = aSourceMap._sourceRoot;
    smc.sourcesContent = aSourceMap._generateSourcesContent(smc._sources.toArray(),
                                                            smc.sourceRoot);
    smc.file = aSourceMap._file;
    smc._sourceMapURL = aSourceMapURL;
    smc._absoluteSources = smc._sources.toArray().map(function (s) {
      return util.computeSourceURL(smc.sourceRoot, s, aSourceMapURL);
    });

    // Because we are modifying the entries (by converting string sources and
    // names to indices into the sources and names ArraySets), we have to make
    // a copy of the entry or else bad things happen. Shared mutable state
    // strikes again! See github issue #191.

    var generatedMappings = aSourceMap._mappings.toArray().slice();
    var destGeneratedMappings = smc.__generatedMappings = [];
    var destOriginalMappings = smc.__originalMappings = [];

    for (var i = 0, length = generatedMappings.length; i < length; i++) {
      var srcMapping = generatedMappings[i];
      var destMapping = new Mapping;
      destMapping.generatedLine = srcMapping.generatedLine;
      destMapping.generatedColumn = srcMapping.generatedColumn;

      if (srcMapping.source) {
        destMapping.source = sources.indexOf(srcMapping.source);
        destMapping.originalLine = srcMapping.originalLine;
        destMapping.originalColumn = srcMapping.originalColumn;

        if (srcMapping.name) {
          destMapping.name = names.indexOf(srcMapping.name);
        }

        destOriginalMappings.push(destMapping);
      }

      destGeneratedMappings.push(destMapping);
    }

    quickSort(smc.__originalMappings, util.compareByOriginalPositions);

    return smc;
  };

/**
 * The version of the source mapping spec that we are consuming.
 */
BasicSourceMapConsumer.prototype._version = 3;

/**
 * The list of original sources.
 */
Object.defineProperty(BasicSourceMapConsumer.prototype, 'sources', {
  get: function () {
    return this._absoluteSources.slice();
  }
});

/**
 * Provide the JIT with a nice shape / hidden class.
 */
function Mapping() {
  this.generatedLine = 0;
  this.generatedColumn = 0;
  this.source = null;
  this.originalLine = null;
  this.originalColumn = null;
  this.name = null;
}

/**
 * Parse the mappings in a string in to a data structure which we can easily
 * query (the ordered arrays in the `this.__generatedMappings` and
 * `this.__originalMappings` properties).
 */
BasicSourceMapConsumer.prototype._parseMappings =
  function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
    var generatedLine = 1;
    var previousGeneratedColumn = 0;
    var previousOriginalLine = 0;
    var previousOriginalColumn = 0;
    var previousSource = 0;
    var previousName = 0;
    var length = aStr.length;
    var index = 0;
    var cachedSegments = {};
    var temp = {};
    var originalMappings = [];
    var generatedMappings = [];
    var mapping, str, segment, end, value;

    while (index < length) {
      if (aStr.charAt(index) === ';') {
        generatedLine++;
        index++;
        previousGeneratedColumn = 0;
      }
      else if (aStr.charAt(index) === ',') {
        index++;
      }
      else {
        mapping = new Mapping();
        mapping.generatedLine = generatedLine;

        // Because each offset is encoded relative to the previous one,
        // many segments often have the same encoding. We can exploit this
        // fact by caching the parsed variable length fields of each segment,
        // allowing us to avoid a second parse if we encounter the same
        // segment again.
        for (end = index; end < length; end++) {
          if (this._charIsMappingSeparator(aStr, end)) {
            break;
          }
        }
        str = aStr.slice(index, end);

        segment = cachedSegments[str];
        if (segment) {
          index += str.length;
        } else {
          segment = [];
          while (index < end) {
            base64Vlq.decode(aStr, index, temp);
            value = temp.value;
            index = temp.rest;
            segment.push(value);
          }

          if (segment.length === 2) {
            throw new Error('Found a source, but no line and column');
          }

          if (segment.length === 3) {
            throw new Error('Found a source and line, but no column');
          }

          cachedSegments[str] = segment;
        }

        // Generated column.
        mapping.generatedColumn = previousGeneratedColumn + segment[0];
        previousGeneratedColumn = mapping.generatedColumn;

        if (segment.length > 1) {
          // Original source.
          mapping.source = previousSource + segment[1];
          previousSource += segment[1];

          // Original line.
          mapping.originalLine = previousOriginalLine + segment[2];
          previousOriginalLine = mapping.originalLine;
          // Lines are stored 0-based
          mapping.originalLine += 1;

          // Original column.
          mapping.originalColumn = previousOriginalColumn + segment[3];
          previousOriginalColumn = mapping.originalColumn;

          if (segment.length > 4) {
            // Original name.
            mapping.name = previousName + segment[4];
            previousName += segment[4];
          }
        }

        generatedMappings.push(mapping);
        if (typeof mapping.originalLine === 'number') {
          originalMappings.push(mapping);
        }
      }
    }

    quickSort(generatedMappings, util.compareByGeneratedPositionsDeflated);
    this.__generatedMappings = generatedMappings;

    quickSort(originalMappings, util.compareByOriginalPositions);
    this.__originalMappings = originalMappings;
  };

/**
 * Find the mapping that best matches the hypothetical "needle" mapping that
 * we are searching for in the given "haystack" of mappings.
 */
BasicSourceMapConsumer.prototype._findMapping =
  function SourceMapConsumer_findMapping(aNeedle, aMappings, aLineName,
                                         aColumnName, aComparator, aBias) {
    // To return the position we are searching for, we must first find the
    // mapping for the given position and then return the opposite position it
    // points to. Because the mappings are sorted, we can use binary search to
    // find the best mapping.

    if (aNeedle[aLineName] <= 0) {
      throw new TypeError('Line must be greater than or equal to 1, got '
                          + aNeedle[aLineName]);
    }
    if (aNeedle[aColumnName] < 0) {
      throw new TypeError('Column must be greater than or equal to 0, got '
                          + aNeedle[aColumnName]);
    }

    return binarySearch.search(aNeedle, aMappings, aComparator, aBias);
  };

/**
 * Compute the last column for each generated mapping. The last column is
 * inclusive.
 */
BasicSourceMapConsumer.prototype.computeColumnSpans =
  function SourceMapConsumer_computeColumnSpans() {
    for (var index = 0; index < this._generatedMappings.length; ++index) {
      var mapping = this._generatedMappings[index];

      // Mappings do not contain a field for the last generated columnt. We
      // can come up with an optimistic estimate, however, by assuming that
      // mappings are contiguous (i.e. given two consecutive mappings, the
      // first mapping ends where the second one starts).
      if (index + 1 < this._generatedMappings.length) {
        var nextMapping = this._generatedMappings[index + 1];

        if (mapping.generatedLine === nextMapping.generatedLine) {
          mapping.lastGeneratedColumn = nextMapping.generatedColumn - 1;
          continue;
        }
      }

      // The last mapping for each line spans the entire line.
      mapping.lastGeneratedColumn = Infinity;
    }
  };

/**
 * Returns the original source, line, and column information for the generated
 * source's line and column positions provided. The only argument is an object
 * with the following properties:
 *
 *   - line: The line number in the generated source.  The line number
 *     is 1-based.
 *   - column: The column number in the generated source.  The column
 *     number is 0-based.
 *   - bias: Either 'SourceMapConsumer.GREATEST_LOWER_BOUND' or
 *     'SourceMapConsumer.LEAST_UPPER_BOUND'. Specifies whether to return the
 *     closest element that is smaller than or greater than the one we are
 *     searching for, respectively, if the exact element cannot be found.
 *     Defaults to 'SourceMapConsumer.GREATEST_LOWER_BOUND'.
 *
 * and an object is returned with the following properties:
 *
 *   - source: The original source file, or null.
 *   - line: The line number in the original source, or null.  The
 *     line number is 1-based.
 *   - column: The column number in the original source, or null.  The
 *     column number is 0-based.
 *   - name: The original identifier, or null.
 */
BasicSourceMapConsumer.prototype.originalPositionFor =
  function SourceMapConsumer_originalPositionFor(aArgs) {
    var needle = {
      generatedLine: util.getArg(aArgs, 'line'),
      generatedColumn: util.getArg(aArgs, 'column')
    };

    var index = this._findMapping(
      needle,
      this._generatedMappings,
      "generatedLine",
      "generatedColumn",
      util.compareByGeneratedPositionsDeflated,
      util.getArg(aArgs, 'bias', SourceMapConsumer$1.GREATEST_LOWER_BOUND)
    );

    if (index >= 0) {
      var mapping = this._generatedMappings[index];

      if (mapping.generatedLine === needle.generatedLine) {
        var source = util.getArg(mapping, 'source', null);
        if (source !== null) {
          source = this._sources.at(source);
          source = util.computeSourceURL(this.sourceRoot, source, this._sourceMapURL);
        }
        var name = util.getArg(mapping, 'name', null);
        if (name !== null) {
          name = this._names.at(name);
        }
        return {
          source: source,
          line: util.getArg(mapping, 'originalLine', null),
          column: util.getArg(mapping, 'originalColumn', null),
          name: name
        };
      }
    }

    return {
      source: null,
      line: null,
      column: null,
      name: null
    };
  };

/**
 * Return true if we have the source content for every source in the source
 * map, false otherwise.
 */
BasicSourceMapConsumer.prototype.hasContentsOfAllSources =
  function BasicSourceMapConsumer_hasContentsOfAllSources() {
    if (!this.sourcesContent) {
      return false;
    }
    return this.sourcesContent.length >= this._sources.size() &&
      !this.sourcesContent.some(function (sc) { return sc == null; });
  };

/**
 * Returns the original source content. The only argument is the url of the
 * original source file. Returns null if no original source content is
 * available.
 */
BasicSourceMapConsumer.prototype.sourceContentFor =
  function SourceMapConsumer_sourceContentFor(aSource, nullOnMissing) {
    if (!this.sourcesContent) {
      return null;
    }

    var index = this._findSourceIndex(aSource);
    if (index >= 0) {
      return this.sourcesContent[index];
    }

    var relativeSource = aSource;
    if (this.sourceRoot != null) {
      relativeSource = util.relative(this.sourceRoot, relativeSource);
    }

    var url;
    if (this.sourceRoot != null
        && (url = util.urlParse(this.sourceRoot))) {
      // XXX: file:// URIs and absolute paths lead to unexpected behavior for
      // many users. We can help them out when they expect file:// URIs to
      // behave like it would if they were running a local HTTP server. See
      // https://bugzilla.mozilla.org/show_bug.cgi?id=885597.
      var fileUriAbsPath = relativeSource.replace(/^file:\/\//, "");
      if (url.scheme == "file"
          && this._sources.has(fileUriAbsPath)) {
        return this.sourcesContent[this._sources.indexOf(fileUriAbsPath)]
      }

      if ((!url.path || url.path == "/")
          && this._sources.has("/" + relativeSource)) {
        return this.sourcesContent[this._sources.indexOf("/" + relativeSource)];
      }
    }

    // This function is used recursively from
    // IndexedSourceMapConsumer.prototype.sourceContentFor. In that case, we
    // don't want to throw if we can't find the source - we just want to
    // return null, so we provide a flag to exit gracefully.
    if (nullOnMissing) {
      return null;
    }
    else {
      throw new Error('"' + relativeSource + '" is not in the SourceMap.');
    }
  };

/**
 * Returns the generated line and column information for the original source,
 * line, and column positions provided. The only argument is an object with
 * the following properties:
 *
 *   - source: The filename of the original source.
 *   - line: The line number in the original source.  The line number
 *     is 1-based.
 *   - column: The column number in the original source.  The column
 *     number is 0-based.
 *   - bias: Either 'SourceMapConsumer.GREATEST_LOWER_BOUND' or
 *     'SourceMapConsumer.LEAST_UPPER_BOUND'. Specifies whether to return the
 *     closest element that is smaller than or greater than the one we are
 *     searching for, respectively, if the exact element cannot be found.
 *     Defaults to 'SourceMapConsumer.GREATEST_LOWER_BOUND'.
 *
 * and an object is returned with the following properties:
 *
 *   - line: The line number in the generated source, or null.  The
 *     line number is 1-based.
 *   - column: The column number in the generated source, or null.
 *     The column number is 0-based.
 */
BasicSourceMapConsumer.prototype.generatedPositionFor =
  function SourceMapConsumer_generatedPositionFor(aArgs) {
    var source = util.getArg(aArgs, 'source');
    source = this._findSourceIndex(source);
    if (source < 0) {
      return {
        line: null,
        column: null,
        lastColumn: null
      };
    }

    var needle = {
      source: source,
      originalLine: util.getArg(aArgs, 'line'),
      originalColumn: util.getArg(aArgs, 'column')
    };

    var index = this._findMapping(
      needle,
      this._originalMappings,
      "originalLine",
      "originalColumn",
      util.compareByOriginalPositions,
      util.getArg(aArgs, 'bias', SourceMapConsumer$1.GREATEST_LOWER_BOUND)
    );

    if (index >= 0) {
      var mapping = this._originalMappings[index];

      if (mapping.source === needle.source) {
        return {
          line: util.getArg(mapping, 'generatedLine', null),
          column: util.getArg(mapping, 'generatedColumn', null),
          lastColumn: util.getArg(mapping, 'lastGeneratedColumn', null)
        };
      }
    }

    return {
      line: null,
      column: null,
      lastColumn: null
    };
  };

var BasicSourceMapConsumer_1 = BasicSourceMapConsumer;

/**
 * An IndexedSourceMapConsumer instance represents a parsed source map which
 * we can query for information. It differs from BasicSourceMapConsumer in
 * that it takes "indexed" source maps (i.e. ones with a "sections" field) as
 * input.
 *
 * The first parameter is a raw source map (either as a JSON string, or already
 * parsed to an object). According to the spec for indexed source maps, they
 * have the following attributes:
 *
 *   - version: Which version of the source map spec this map is following.
 *   - file: Optional. The generated file this source map is associated with.
 *   - sections: A list of section definitions.
 *
 * Each value under the "sections" field has two fields:
 *   - offset: The offset into the original specified at which this section
 *       begins to apply, defined as an object with a "line" and "column"
 *       field.
 *   - map: A source map definition. This source map could also be indexed,
 *       but doesn't have to be.
 *
 * Instead of the "map" field, it's also possible to have a "url" field
 * specifying a URL to retrieve a source map from, but that's currently
 * unsupported.
 *
 * Here's an example source map, taken from the source map spec[0], but
 * modified to omit a section which uses the "url" field.
 *
 *  {
 *    version : 3,
 *    file: "app.js",
 *    sections: [{
 *      offset: {line:100, column:10},
 *      map: {
 *        version : 3,
 *        file: "section.js",
 *        sources: ["foo.js", "bar.js"],
 *        names: ["src", "maps", "are", "fun"],
 *        mappings: "AAAA,E;;ABCDE;"
 *      }
 *    }],
 *  }
 *
 * The second parameter, if given, is a string whose value is the URL
 * at which the source map was found.  This URL is used to compute the
 * sources array.
 *
 * [0]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit#heading=h.535es3xeprgt
 */
function IndexedSourceMapConsumer(aSourceMap, aSourceMapURL) {
  var sourceMap = aSourceMap;
  if (typeof aSourceMap === 'string') {
    sourceMap = util.parseSourceMapInput(aSourceMap);
  }

  var version = util.getArg(sourceMap, 'version');
  var sections = util.getArg(sourceMap, 'sections');

  if (version != this._version) {
    throw new Error('Unsupported version: ' + version);
  }

  this._sources = new ArraySet();
  this._names = new ArraySet();

  var lastOffset = {
    line: -1,
    column: 0
  };
  this._sections = sections.map(function (s) {
    if (s.url) {
      // The url field will require support for asynchronicity.
      // See https://github.com/mozilla/source-map/issues/16
      throw new Error('Support for url field in sections not implemented.');
    }
    var offset = util.getArg(s, 'offset');
    var offsetLine = util.getArg(offset, 'line');
    var offsetColumn = util.getArg(offset, 'column');

    if (offsetLine < lastOffset.line ||
        (offsetLine === lastOffset.line && offsetColumn < lastOffset.column)) {
      throw new Error('Section offsets must be ordered and non-overlapping.');
    }
    lastOffset = offset;

    return {
      generatedOffset: {
        // The offset fields are 0-based, but we use 1-based indices when
        // encoding/decoding from VLQ.
        generatedLine: offsetLine + 1,
        generatedColumn: offsetColumn + 1
      },
      consumer: new SourceMapConsumer$1(util.getArg(s, 'map'), aSourceMapURL)
    }
  });
}

IndexedSourceMapConsumer.prototype = Object.create(SourceMapConsumer$1.prototype);
IndexedSourceMapConsumer.prototype.constructor = SourceMapConsumer$1;

/**
 * The version of the source mapping spec that we are consuming.
 */
IndexedSourceMapConsumer.prototype._version = 3;

/**
 * The list of original sources.
 */
Object.defineProperty(IndexedSourceMapConsumer.prototype, 'sources', {
  get: function () {
    var sources = [];
    for (var i = 0; i < this._sections.length; i++) {
      for (var j = 0; j < this._sections[i].consumer.sources.length; j++) {
        sources.push(this._sections[i].consumer.sources[j]);
      }
    }
    return sources;
  }
});

/**
 * Returns the original source, line, and column information for the generated
 * source's line and column positions provided. The only argument is an object
 * with the following properties:
 *
 *   - line: The line number in the generated source.  The line number
 *     is 1-based.
 *   - column: The column number in the generated source.  The column
 *     number is 0-based.
 *
 * and an object is returned with the following properties:
 *
 *   - source: The original source file, or null.
 *   - line: The line number in the original source, or null.  The
 *     line number is 1-based.
 *   - column: The column number in the original source, or null.  The
 *     column number is 0-based.
 *   - name: The original identifier, or null.
 */
IndexedSourceMapConsumer.prototype.originalPositionFor =
  function IndexedSourceMapConsumer_originalPositionFor(aArgs) {
    var needle = {
      generatedLine: util.getArg(aArgs, 'line'),
      generatedColumn: util.getArg(aArgs, 'column')
    };

    // Find the section containing the generated position we're trying to map
    // to an original position.
    var sectionIndex = binarySearch.search(needle, this._sections,
      function(needle, section) {
        var cmp = needle.generatedLine - section.generatedOffset.generatedLine;
        if (cmp) {
          return cmp;
        }

        return (needle.generatedColumn -
                section.generatedOffset.generatedColumn);
      });
    var section = this._sections[sectionIndex];

    if (!section) {
      return {
        source: null,
        line: null,
        column: null,
        name: null
      };
    }

    return section.consumer.originalPositionFor({
      line: needle.generatedLine -
        (section.generatedOffset.generatedLine - 1),
      column: needle.generatedColumn -
        (section.generatedOffset.generatedLine === needle.generatedLine
         ? section.generatedOffset.generatedColumn - 1
         : 0),
      bias: aArgs.bias
    });
  };

/**
 * Return true if we have the source content for every source in the source
 * map, false otherwise.
 */
IndexedSourceMapConsumer.prototype.hasContentsOfAllSources =
  function IndexedSourceMapConsumer_hasContentsOfAllSources() {
    return this._sections.every(function (s) {
      return s.consumer.hasContentsOfAllSources();
    });
  };

/**
 * Returns the original source content. The only argument is the url of the
 * original source file. Returns null if no original source content is
 * available.
 */
IndexedSourceMapConsumer.prototype.sourceContentFor =
  function IndexedSourceMapConsumer_sourceContentFor(aSource, nullOnMissing) {
    for (var i = 0; i < this._sections.length; i++) {
      var section = this._sections[i];

      var content = section.consumer.sourceContentFor(aSource, true);
      if (content) {
        return content;
      }
    }
    if (nullOnMissing) {
      return null;
    }
    else {
      throw new Error('"' + aSource + '" is not in the SourceMap.');
    }
  };

/**
 * Returns the generated line and column information for the original source,
 * line, and column positions provided. The only argument is an object with
 * the following properties:
 *
 *   - source: The filename of the original source.
 *   - line: The line number in the original source.  The line number
 *     is 1-based.
 *   - column: The column number in the original source.  The column
 *     number is 0-based.
 *
 * and an object is returned with the following properties:
 *
 *   - line: The line number in the generated source, or null.  The
 *     line number is 1-based. 
 *   - column: The column number in the generated source, or null.
 *     The column number is 0-based.
 */
IndexedSourceMapConsumer.prototype.generatedPositionFor =
  function IndexedSourceMapConsumer_generatedPositionFor(aArgs) {
    for (var i = 0; i < this._sections.length; i++) {
      var section = this._sections[i];

      // Only consider this section if the requested source is in the list of
      // sources of the consumer.
      if (section.consumer._findSourceIndex(util.getArg(aArgs, 'source')) === -1) {
        continue;
      }
      var generatedPosition = section.consumer.generatedPositionFor(aArgs);
      if (generatedPosition) {
        var ret = {
          line: generatedPosition.line +
            (section.generatedOffset.generatedLine - 1),
          column: generatedPosition.column +
            (section.generatedOffset.generatedLine === generatedPosition.line
             ? section.generatedOffset.generatedColumn - 1
             : 0)
        };
        return ret;
      }
    }

    return {
      line: null,
      column: null
    };
  };

/**
 * Parse the mappings in a string in to a data structure which we can easily
 * query (the ordered arrays in the `this.__generatedMappings` and
 * `this.__originalMappings` properties).
 */
IndexedSourceMapConsumer.prototype._parseMappings =
  function IndexedSourceMapConsumer_parseMappings(aStr, aSourceRoot) {
    this.__generatedMappings = [];
    this.__originalMappings = [];
    for (var i = 0; i < this._sections.length; i++) {
      var section = this._sections[i];
      var sectionMappings = section.consumer._generatedMappings;
      for (var j = 0; j < sectionMappings.length; j++) {
        var mapping = sectionMappings[j];

        var source = section.consumer._sources.at(mapping.source);
        source = util.computeSourceURL(section.consumer.sourceRoot, source, this._sourceMapURL);
        this._sources.add(source);
        source = this._sources.indexOf(source);

        var name = null;
        if (mapping.name) {
          name = section.consumer._names.at(mapping.name);
          this._names.add(name);
          name = this._names.indexOf(name);
        }

        // The mappings coming from the consumer for the section have
        // generated positions relative to the start of the section, so we
        // need to offset them to be relative to the start of the concatenated
        // generated file.
        var adjustedMapping = {
          source: source,
          generatedLine: mapping.generatedLine +
            (section.generatedOffset.generatedLine - 1),
          generatedColumn: mapping.generatedColumn +
            (section.generatedOffset.generatedLine === mapping.generatedLine
            ? section.generatedOffset.generatedColumn - 1
            : 0),
          originalLine: mapping.originalLine,
          originalColumn: mapping.originalColumn,
          name: name
        };

        this.__generatedMappings.push(adjustedMapping);
        if (typeof adjustedMapping.originalLine === 'number') {
          this.__originalMappings.push(adjustedMapping);
        }
      }
    }

    quickSort(this.__generatedMappings, util.compareByGeneratedPositionsDeflated);
    quickSort(this.__originalMappings, util.compareByOriginalPositions);
  };

var IndexedSourceMapConsumer_1 = IndexedSourceMapConsumer;

var sourceMapConsumer = {
	SourceMapConsumer: SourceMapConsumer_1,
	BasicSourceMapConsumer: BasicSourceMapConsumer_1,
	IndexedSourceMapConsumer: IndexedSourceMapConsumer_1
};

var SourceMapConsumer = sourceMapConsumer.SourceMapConsumer;

class ErrorMapper {
    static get consumer() {
        if (this._consumer == null) {
            this._consumer = new SourceMapConsumer(require("main.js.map"));
        }
        return this._consumer;
    }
    /**
     * Generates a stack trace using a source map generate original symbol names.
     *
     * WARNING - EXTREMELY high CPU cost for first call after reset - >30 CPU! Use sparingly!
     * (Consecutive calls after a reset are more reasonable, ~0.1 CPU/ea)
     *
     * @param {Error | string} error The error or original stack trace
     * @returns {string} The source-mapped stack trace
     */
    static sourceMappedStackTrace(error) {
        const stack = error instanceof Error ? error.stack : error;
        if (Object.prototype.hasOwnProperty.call(this.cache, stack)) {
            return this.cache[stack];
        }
        // eslint-disable-next-line no-useless-escape
        const re = /^\s+at\s+(.+?\s+)?\(?([0-z._\-\\\/]+):(\d+):(\d+)\)?$/gm;
        let match;
        let outStack = error.toString();
        while ((match = re.exec(stack))) {
            if (match[2] === "main") {
                const pos = this.consumer.originalPositionFor({
                    column: parseInt(match[4], 10),
                    line: parseInt(match[3], 10)
                });
                if (pos.line != null) {
                    if (pos.name) {
                        outStack += `\n    at ${pos.name} (${pos.source}:${pos.line}:${pos.column})`;
                    }
                    else {
                        if (match[1]) {
                            // no original source file name known - use file name from given trace
                            outStack += `\n    at ${match[1]} (${pos.source}:${pos.line}:${pos.column})`;
                        }
                        else {
                            // no original source file name known or in given trace - omit name
                            outStack += `\n    at ${pos.source}:${pos.line}:${pos.column}`;
                        }
                    }
                }
                else {
                    // no known position
                    break;
                }
            }
            else {
                // no more parseable lines
                break;
            }
        }
        this.cache[stack] = outStack;
        return outStack;
    }
    static wrapLoop(loop) {
        return () => {
            try {
                loop();
            }
            catch (e) {
                if (e instanceof Error) {
                    if ("sim" in Game.rooms) {
                        const message = `Source maps don't work in the simulator - displaying original error`;
                        console.log(`<span style='color:red'>${message}<br>${_.escape(e.stack)}</span>`);
                    }
                    else {
                        console.log(`<span style='color:red'>${_.escape(this.sourceMappedStackTrace(e))}</span>`);
                    }
                }
                else {
                    // can't handle it
                    throw e;
                }
            }
        };
    }
}
// Cache previously mapped traces to improve performance
ErrorMapper.cache = {};

class Mem {
    static init() {
        if (!Memory.masters)
            Memory.masters = {};
        if (!Memory.log) {
            Memory.log = { spawns: [] };
        }
    }
    static clean() {
        for (const name in Memory.creeps) {
            if (!(name in Game.creeps)) {
                delete Memory.creeps[name];
            }
        }
        if (Memory.log.spawns.length > 50) {
            Memory.log.spawns.splice(0, Memory.log.spawns.length - 10);
        }
    }
}

/**
 * To start using Traveler, require it in main.js:
 * Example: var Traveler = require('Traveler.js');
 */
class Traveler {
    /**
     * move creep to destination
     * @param creep
     * @param destination
     * @param options
     * @returns {number}
     */
    static travelTo(creep, destination, options = {}) {
        // uncomment if you would like to register hostile rooms entered
        // this.updateRoomStatus(creep.room);
        if (!destination) {
            return ERR_INVALID_ARGS;
        }
        if (creep.fatigue > 0) {
            Traveler.circle(creep.pos, "aqua", .3);
            return ERR_TIRED;
        }
        destination = this.normalizePos(destination);
        // manage case where creep is nearby destination
        let rangeToDestination = creep.pos.getRangeTo(destination);
        if (options.range && rangeToDestination <= options.range) {
            return OK;
        }
        else if (rangeToDestination <= 1) {
            if (rangeToDestination === 1 && !options.range) {
                let direction = creep.pos.getDirectionTo(destination);
                if (options.returnData) {
                    options.returnData.nextPos = destination;
                    options.returnData.path = direction.toString();
                }
                return creep.move(direction);
            }
            return OK;
        }
        // initialize data object
        if (!creep.memory._trav) {
            delete creep.memory._travel;
            creep.memory._trav = {};
        }
        let travelData = creep.memory._trav;
        let state = this.deserializeState(travelData, destination);
        // uncomment to visualize destination
        // this.circle(destination.pos, "orange");
        // check if creep is stuck
        if (this.isStuck(creep, state)) {
            state.stuckCount++;
            Traveler.circle(creep.pos, "magenta", state.stuckCount * .2);
        }
        else {
            state.stuckCount = 0;
        }
        // handle case where creep is stuck
        if (!options.stuckValue) {
            options.stuckValue = DEFAULT_STUCK_VALUE;
        }
        if (state.stuckCount >= options.stuckValue && Math.random() > .5) {
            options.ignoreCreeps = false;
            options.freshMatrix = true;
            delete travelData.path;
        }
        // TODO:handle case where creep moved by some other function, but destination is still the same
        // delete path cache if destination is different
        if (!this.samePos(state.destination, destination)) {
            if (options.movingTarget && state.destination.isNearTo(destination)) {
                travelData.path += state.destination.getDirectionTo(destination);
                state.destination = destination;
            }
            else {
                delete travelData.path;
            }
        }
        if (options.repath && Math.random() < options.repath) {
            // add some chance that you will find a new path randomly
            delete travelData.path;
        }
        // pathfinding
        let newPath = false;
        if (!travelData.path) {
            newPath = true;
            if (creep.spawning) {
                return ERR_BUSY;
            }
            state.destination = destination;
            let cpu = Game.cpu.getUsed();
            let ret = this.findTravelPath(creep.pos, destination, options);
            let cpuUsed = Game.cpu.getUsed() - cpu;
            state.cpu = _.round(cpuUsed + state.cpu);
            if (state.cpu > REPORT_CPU_THRESHOLD) {
                // see note at end of file for more info on this
                console.log(`TRAVELER: heavy cpu use: ${creep.name}, cpu: ${state.cpu} origin: ${creep.pos}, dest: ${destination}`);
            }
            let color = "orange";
            if (ret.incomplete) {
                // uncommenting this is a great way to diagnose creep behavior issues
                // console.log(`TRAVELER: incomplete path for ${creep.name}`);
                color = "red";
            }
            if (options.returnData) {
                options.returnData.pathfinderReturn = ret;
            }
            travelData.path = Traveler.serializePath(creep.pos, ret.path, color);
            state.stuckCount = 0;
        }
        this.serializeState(creep, destination, state, travelData);
        if (!travelData.path || travelData.path.length === 0) {
            return ERR_NO_PATH;
        }
        // consume path
        if (state.stuckCount === 0 && !newPath) {
            travelData.path = travelData.path.substr(1);
        }
        let nextDirection = parseInt(travelData.path[0], 10);
        if (options.returnData) {
            if (nextDirection) {
                let nextPos = Traveler.positionAtDirection(creep.pos, nextDirection);
                if (nextPos) {
                    options.returnData.nextPos = nextPos;
                }
            }
            options.returnData.state = state;
            options.returnData.path = travelData.path;
        }
        return creep.move(nextDirection);
    }
    /**
     * make position objects consistent so that either can be used as an argument
     * @param destination
     * @returns {any}
     */
    static normalizePos(destination) {
        if (!(destination instanceof RoomPosition)) {
            return destination.pos;
        }
        return destination;
    }
    /**
     * check if room should be avoided by findRoute algorithm
     * @param roomName
     * @returns {RoomMemory|number}
     */
    static checkAvoid(roomName) {
        return Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].avoid;
    }
    /**
     * check if a position is an exit
     * @param pos
     * @returns {boolean}
     */
    static isExit(pos) {
        return pos.x === 0 || pos.y === 0 || pos.x === 49 || pos.y === 49;
    }
    /**
     * check two coordinates match
     * @param pos1
     * @param pos2
     * @returns {boolean}
     */
    static sameCoord(pos1, pos2) {
        return pos1.x === pos2.x && pos1.y === pos2.y;
    }
    /**
     * check if two positions match
     * @param pos1
     * @param pos2
     * @returns {boolean}
     */
    static samePos(pos1, pos2) {
        return this.sameCoord(pos1, pos2) && pos1.roomName === pos2.roomName;
    }
    /**
     * draw a circle at position
     * @param pos
     * @param color
     * @param opacity
     */
    static circle(pos, color, opacity) {
        new RoomVisual(pos.roomName).circle(pos, {
                radius: .45, fill: "transparent", stroke: color, strokeWidth: .15, opacity: opacity
            });
    }
    /**
     * update memory on whether a room should be avoided based on controller owner
     * @param room
     */
    static updateRoomStatus(room) {
        if (!room) {
            return;
        }
        if (room.controller) {
            if (room.controller.owner && !room.controller.my) {
                room.memory.avoid = 1;
            }
            else {
                delete room.memory.avoid;
            }
        }
    }
    /**
     * find a path from origin to destination
     * @param origin
     * @param destination
     * @param options
     * @returns {PathfinderReturn}
     */
    static findTravelPath(origin, destination, options = {}) {
        _.defaults(options, {
            ignoreCreeps: true,
            maxOps: DEFAULT_MAXOPS,
            range: 1,
        });
        if (options.movingTarget) {
            options.range = 0;
        }
        origin = this.normalizePos(origin);
        destination = this.normalizePos(destination);
        let originRoomName = origin.roomName;
        let destRoomName = destination.roomName;
        // check to see whether findRoute should be used
        let roomDistance = Game.map.getRoomLinearDistance(origin.roomName, destination.roomName);
        let allowedRooms = options.route;
        if (!allowedRooms && (options.useFindRoute || (options.useFindRoute === undefined && roomDistance > 2))) {
            let route = this.findRoute(origin.roomName, destination.roomName, options);
            if (route) {
                allowedRooms = route;
            }
        }
        // let roomsSearched = 0; // this was never used -_- SUS
        let callback = (roomName) => {
            if (allowedRooms) {
                if (!allowedRooms[roomName]) {
                    return false;
                }
            }
            else if (!options.allowHostile && Traveler.checkAvoid(roomName)
                && roomName !== destRoomName && roomName !== originRoomName) {
                return false;
            }
            // roomsSearched++;
            let matrix;
            let room = Game.rooms[roomName];
            if (room) {
                if (options.ignoreStructures) {
                    matrix = new PathFinder.CostMatrix();
                    if (!options.ignoreCreeps) {
                        Traveler.addCreepsToMatrix(room, matrix);
                    }
                }
                else if (options.ignoreCreeps || roomName !== originRoomName) {
                    matrix = this.getStructureMatrix(room, options.freshMatrix);
                }
                else {
                    matrix = this.getCreepMatrix(room);
                }
                if (options.obstacles) {
                    matrix = matrix.clone();
                    for (let obstacle of options.obstacles) {
                        if (obstacle.pos.roomName !== roomName) {
                            continue;
                        }
                        matrix.set(obstacle.pos.x, obstacle.pos.y, 0xff);
                    }
                }
            }
            if (options.roomCallback) {
                if (!matrix) {
                    matrix = new PathFinder.CostMatrix();
                }
                let outcome = options.roomCallback(roomName, matrix.clone());
                if (outcome !== undefined) {
                    return outcome;
                }
            }
            return matrix;
        };
        let ret = PathFinder.search(origin, { pos: destination, range: options.range }, {
            maxOps: options.maxOps,
            maxRooms: options.maxRooms,
            plainCost: options.offRoad ? 1 : options.ignoreRoads ? 1 : 2,
            swampCost: options.offRoad ? 1 : options.ignoreRoads ? 5 : 10,
            roomCallback: callback,
        });
        if (ret.incomplete && options.ensurePath) {
            if (options.useFindRoute === undefined) {
                // handle case where pathfinder failed at a short distance due to not using findRoute
                // can happen for situations where the creep would have to take an uncommonly indirect path
                // options.allowedRooms and options.routeCallback can also be used to handle this situation
                if (roomDistance <= 2) {
                    console.log(`TRAVELER: path failed without findroute, trying with options.useFindRoute = true`);
                    console.log(`from: ${origin}, destination: ${destination}`);
                    options.useFindRoute = true;
                    ret = this.findTravelPath(origin, destination, options);
                    console.log(`TRAVELER: second attempt was ${ret.incomplete ? "not " : ""}successful`);
                    return ret;
                }
                // TODO: handle case where a wall or some other obstacle is blocking the exit assumed by findRoute
            }
        }
        return ret;
    }
    /**
     * find a viable sequence of rooms that can be used to narrow down pathfinder's search algorithm
     * @param origin
     * @param destination
     * @param options
     * @returns {{}}
     */
    static findRoute(origin, destination, options = {}) {
        let restrictDistance = options.restrictDistance || Game.map.getRoomLinearDistance(origin, destination) + 10;
        let allowedRooms = { [origin]: true, [destination]: true };
        let highwayBias = 1;
        if (options.preferHighway) {
            highwayBias = 2.5;
            if (options.highwayBias) {
                highwayBias = options.highwayBias;
            }
        }
        let ret = Game.map.findRoute(origin, destination, {
            routeCallback: (roomName) => {
                if (options.routeCallback) {
                    let outcome = options.routeCallback(roomName);
                    if (outcome !== undefined) {
                        return outcome;
                    }
                }
                let rangeToRoom = Game.map.getRoomLinearDistance(origin, roomName);
                if (rangeToRoom > restrictDistance) {
                    // room is too far out of the way
                    return Number.POSITIVE_INFINITY;
                }
                if (!options.allowHostile && Traveler.checkAvoid(roomName) &&
                    roomName !== destination && roomName !== origin) {
                    // room is marked as "avoid" in room memory
                    return Number.POSITIVE_INFINITY;
                }
                let parsed;
                if (options.preferHighway) {
                    parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
                    let isHighway = (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
                    if (isHighway) {
                        return 1;
                    }
                }
                // SK rooms are avoided when there is no vision in the room, harvested-from SK rooms are allowed
                if (!options.allowSK && !Game.rooms[roomName]) {
                    if (!parsed) {
                        parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
                    }
                    let fMod = parsed[1] % 10;
                    let sMod = parsed[2] % 10;
                    let isSK = !(fMod === 5 && sMod === 5) &&
                        ((fMod >= 4) && (fMod <= 6)) &&
                        ((sMod >= 4) && (sMod <= 6));
                    if (isSK) {
                        return 10 * highwayBias;
                    }
                }
                return highwayBias;
            },
        });
        if (!_.isArray(ret)) {
            console.log(`couldn't findRoute to ${destination}`);
            return;
        }
        for (let value of ret) {
            allowedRooms[value.room] = true;
        }
        return allowedRooms;
    }
    /**
     * check how many rooms were included in a route returned by findRoute
     * @param origin
     * @param destination
     * @returns {number}
     */
    static routeDistance(origin, destination) {
        let linearDistance = Game.map.getRoomLinearDistance(origin, destination);
        if (linearDistance >= 32) {
            return linearDistance;
        }
        let allowedRooms = this.findRoute(origin, destination);
        if (allowedRooms) {
            return Object.keys(allowedRooms).length;
        }
    }
    /**
     * build a cost matrix based on structures in the room. Will be cached for more than one tick. Requires vision.
     * @param room
     * @param freshMatrix
     * @returns {any}
     */
    static getStructureMatrix(room, freshMatrix) {
        if (!this.structureMatrixCache[room.name] || (freshMatrix && Game.time !== this.structureMatrixTick)) {
            this.structureMatrixTick = Game.time;
            let matrix = new PathFinder.CostMatrix();
            this.structureMatrixCache[room.name] = Traveler.addStructuresToMatrix(room, matrix, 1);
        }
        return this.structureMatrixCache[room.name];
    }
    /**
     * build a cost matrix based on creeps and structures in the room. Will be cached for one tick. Requires vision.
     * @param room
     * @returns {any}
     */
    static getCreepMatrix(room) {
        if (!this.creepMatrixCache[room.name] || Game.time !== this.creepMatrixTick) {
            this.creepMatrixTick = Game.time;
            this.creepMatrixCache[room.name] = Traveler.addCreepsToMatrix(room, this.getStructureMatrix(room, true).clone());
        }
        return this.creepMatrixCache[room.name];
    }
    /**
     * add structures to matrix so that impassible structures can be avoided and roads given a lower cost
     * @param room
     * @param matrix
     * @param roadCost
     * @returns {CostMatrix}
     */
    static addStructuresToMatrix(room, matrix, roadCost) {
        let impassibleStructures = [];
        for (let structure of room.find(FIND_STRUCTURES)) {
            if (structure instanceof StructureRampart) {
                if (!structure.my && !structure.isPublic) {
                    impassibleStructures.push(structure);
                }
            }
            else if (structure instanceof StructureRoad) {
                matrix.set(structure.pos.x, structure.pos.y, roadCost);
            }
            else if (structure instanceof StructureContainer) {
                matrix.set(structure.pos.x, structure.pos.y, 5);
            }
            else {
                impassibleStructures.push(structure);
            }
        }
        for (let site of room.find(FIND_MY_CONSTRUCTION_SITES)) {
            if (site.structureType === STRUCTURE_CONTAINER || site.structureType === STRUCTURE_ROAD
                || site.structureType === STRUCTURE_RAMPART) {
                continue;
            }
            matrix.set(site.pos.x, site.pos.y, 0xff);
        }
        for (let structure of impassibleStructures) {
            matrix.set(structure.pos.x, structure.pos.y, 0xff);
        }
        return matrix;
    }
    /**
     * add creeps to matrix so that they will be avoided by other creeps
     * @param room
     * @param matrix
     * @returns {CostMatrix}
     */
    static addCreepsToMatrix(room, matrix) {
        room.find(FIND_CREEPS).forEach((creep) => matrix.set(creep.pos.x, creep.pos.y, 0xff));
        return matrix;
    }
    /**
     * serialize a path, traveler style. Returns a string of directions.
     * @param startPos
     * @param path
     * @param color
     * @returns {string}
     */
    static serializePath(startPos, path, color = "orange") {
        let serializedPath = "";
        let lastPosition = startPos;
        this.circle(startPos, color);
        for (let position of path) {
            if (position.roomName === lastPosition.roomName) {
                new RoomVisual(position.roomName)
                        .line(position, lastPosition, { color: color, lineStyle: "dashed" });
                serializedPath += lastPosition.getDirectionTo(position);
            }
            lastPosition = position;
        }
        return serializedPath;
    }
    /**
     * returns a position at a direction relative to origin
     * @param origin
     * @param direction
     * @returns {RoomPosition}
     */
    static positionAtDirection(origin, direction) {
        let offsetX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
        let offsetY = [0, -1, -1, 0, 1, 1, 1, 0, -1];
        let x = origin.x + offsetX[direction];
        let y = origin.y + offsetY[direction];
        if (x > 49 || x < 0 || y > 49 || y < 0) {
            return;
        }
        return new RoomPosition(x, y, origin.roomName);
    }
    /**
     * convert room avoidance memory from the old pattern to the one currently used
     * @param cleanup
     */
    static patchMemory(cleanup = false) {
        if (!Memory.empire) {
            return;
        }
        if (!Memory.empire.hostileRooms) {
            return;
        }
        let count = 0;
        for (let roomName in Memory.empire.hostileRooms) {
            if (Memory.empire.hostileRooms[roomName]) {
                if (!Memory.rooms[roomName]) {
                    Memory.rooms[roomName] = {};
                }
                Memory.rooms[roomName].avoid = 1;
                count++;
            }
            if (cleanup) {
                delete Memory.empire.hostileRooms[roomName];
            }
        }
        if (cleanup) {
            delete Memory.empire.hostileRooms;
        }
        console.log(`TRAVELER: room avoidance data patched for ${count} rooms`);
    }
    static deserializeState(travelData, destination) {
        let state = {};
        if (travelData.state) {
            state.lastCoord = { x: travelData.state[STATE_PREV_X], y: travelData.state[STATE_PREV_Y] };
            state.cpu = travelData.state[STATE_CPU];
            state.stuckCount = travelData.state[STATE_STUCK];
            state.destination = new RoomPosition(travelData.state[STATE_DEST_X], travelData.state[STATE_DEST_Y], travelData.state[STATE_DEST_ROOMNAME]);
        }
        else {
            state.cpu = 0;
            state.destination = destination;
        }
        return state;
    }
    static serializeState(creep, destination, state, travelData) {
        travelData.state = [creep.pos.x, creep.pos.y, state.stuckCount, state.cpu, destination.x, destination.y,
            destination.roomName];
    }
    static isStuck(creep, state) {
        let stuck = false;
        if (state.lastCoord !== undefined) {
            if (this.sameCoord(creep.pos, state.lastCoord)) {
                // didn't move
                stuck = true;
            }
            else if (this.isExit(creep.pos) && this.isExit(state.lastCoord)) {
                // moved against exit
                stuck = true;
            }
        }
        return stuck;
    }
}
Traveler.structureMatrixCache = {};
Traveler.creepMatrixCache = {};
// this might be higher than you wish, setting it lower is a great way to diagnose creep behavior issues. When creeps
// need to repath to often or they aren't finding valid paths, it can sometimes point to problems elsewhere in your code
const REPORT_CPU_THRESHOLD = 1000;
const DEFAULT_MAXOPS = 20000;
const DEFAULT_STUCK_VALUE = 2;
const STATE_PREV_X = 0;
const STATE_PREV_Y = 1;
const STATE_STUCK = 2;
const STATE_CPU = 3;
const STATE_DEST_X = 4;
const STATE_DEST_Y = 5;
const STATE_DEST_ROOMNAME = 6;
// assigns a function to Creep.prototype: creep.travelTo(destination)
Creep.prototype.travelTo = function (destination, options) {
    return Traveler.travelTo(this, destination, options);
};

Creep.prototype.getBodyparts = function (partType) {
    return _.filter(this.body, (part) => part.type == partType).length;
};

RoomPosition.prototype.getNearbyPositions = function () {
    let positions = [];
    let startX = this.x - 1 || 1;
    let startY = this.y - 1 || 1;
    for (let x = startX; x <= this.x + 1 && x < 49; x++) {
        for (let y = startY; y <= this.y + 1 && y < 49; y++) {
            positions.push(new RoomPosition(x, y, this.roomName));
        }
    }
    return positions;
};
RoomPosition.prototype.getWalkablePositions = function () {
    let nearbyPositions = this.getNearbyPositions();
    let terrain = Game.map.getRoomTerrain(this.roomName);
    switch (terrain.get(this.x, this.y)) {
        case TERRAIN_MASK_WALL:
            break;
        case TERRAIN_MASK_SWAMP:
            break;
    }
    let walkablePositions = _.filter(nearbyPositions, function (pos) {
        return terrain.get(pos.x, pos.y) != TERRAIN_MASK_WALL;
    });
    return walkablePositions;
};
RoomPosition.prototype.getOpenPositions = function () {
    let walkablePositions = this.getWalkablePositions();
    let freePositions = _.filter(walkablePositions, function (pos) {
        return !pos.lookFor(LOOK_CREEPS).length;
    });
    return freePositions;
};
RoomPosition.prototype.getTimeForPath = function (roomPos) {
    let path = this.findPathTo(roomPos, {
        ignoreCreeps: true
    });
    //for future i need to iterate and check for roads
    return path.length;
};
// TODO different class types to forget casting in and out
RoomPosition.prototype.findClosest = function (structures) {
    if (structures.length == 0)
        return null;
    let ans = structures[0];
    let distance = Infinity;
    // TODO smarter room-to-room distance
    _.forEach(structures, (structure) => {
        let newDistance = this.getRangeTo(structure);
        if (newDistance < distance) {
            ans = structure;
            distance = newDistance;
        }
    });
    return ans;
};

class Cell {
    constructor(hive, cellName) {
        this.hive = hive;
        this.ref = cellName;
    }
    // first stage of decision making like do i a logistic transfer do i need more beeMasters
    update() {
        // updating structure object to actual data
        _.forEach(Object.keys(this), (key) => {
            let data = this[key];
            if (data instanceof Structure) {
                let gameObject = Game.getObjectById(data.id);
                if (gameObject)
                    this[key] = gameObject;
            }
            else if (Array.isArray(data) && data[0] instanceof Structure) {
                let new_data = [];
                _.forEach(data, (structure) => {
                    let gameObject = Game.getObjectById(structure.id);
                    if (gameObject)
                        new_data.push(gameObject);
                });
                this[key] = new_data;
            }
        });
    }
    print(info) {
        console.log(Game.time, "!", this.ref, "?", info);
    }
}

const partsImportance = [TOUGH, MOVE, WORK, CARRY, CLAIM, RANGED_ATTACK, ATTACK, HEAL];
class CreepSetup {
    constructor(setupName, bodySetup) {
        this.name = setupName;
        this.bodySetup = {
            fixed: [],
            pattern: [],
            patternLimit: Infinity,
        };
        this.bodySetup = bodySetup;
    }
    getBody(energy) {
        let body = [];
        if (this.bodySetup.fixed)
            body = this.bodySetup.fixed;
        let fixedCosts = _.sum(body, s => BODYPART_COST[s]);
        let segmentCost = _.sum(this.bodySetup.pattern, s => BODYPART_COST[s]);
        let limitSegments = Infinity;
        if (this.bodySetup.patternLimit != undefined)
            limitSegments = this.bodySetup.patternLimit;
        let maxSegment = Math.min(limitSegments, Math.floor((energy - fixedCosts) / segmentCost));
        _.times(maxSegment, () => _.forEach(this.bodySetup.pattern, (s) => body.push(s)));
        return body.sort((a, b) => partsImportance.indexOf(a) - partsImportance.indexOf(b));
    }
}
const SetupsNames = {
    // Civilian
    starter: 'Just a bee',
    claimer: 'Bee Drone',
    manager: 'Stingless bee',
    hauler: 'Bumblebee',
    miner: 'Andrena',
    upgrader: 'Honey bee',
    builder: 'Colletidae',
    scout: 'Stenotritidae',
    // War
    knight: 'European hornet',
};
const Setups = {
    starter: new CreepSetup(SetupsNames.starter, {
        pattern: [WORK, CARRY, MOVE],
    }),
    claimer: new CreepSetup(SetupsNames.claimer, {
        pattern: [CLAIM, MOVE],
        patternLimit: 2,
    }),
    manager: new CreepSetup(SetupsNames.manager, {
        pattern: [CARRY, CARRY, MOVE],
        patternLimit: 6,
    }),
    hauler: new CreepSetup(SetupsNames.hauler, {
        pattern: [CARRY, CARRY, MOVE],
        patternLimit: 15,
    }),
    miner: {
        energy: new CreepSetup(SetupsNames.miner, {
            pattern: [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE],
            patternLimit: 1,
        })
    },
    upgrader: {
        manual: new CreepSetup(SetupsNames.upgrader, {
            pattern: [WORK, CARRY, MOVE],
            patternLimit: 10,
        }),
        fast: new CreepSetup(SetupsNames.upgrader, {
            fixed: [WORK, WORK, CARRY, MOVE],
            pattern: [WORK, WORK, MOVE],
            patternLimit: 5,
        }),
    },
    builder: new CreepSetup(SetupsNames.builder, {
        pattern: [WORK, CARRY, MOVE],
        patternLimit: 10,
    }),
    puppet: new CreepSetup(SetupsNames.scout, {
        pattern: [MOVE],
        patternLimit: 1,
    }),
    knight: new CreepSetup(SetupsNames.knight, {
        pattern: [TOUGH, ATTACK, MOVE],
        patternLimit: 10,
    }),
};

// import { makeId } from "../utils/other";
// i will need to do something so i can build up structure from memory
class Master {
    constructor(hive, ref) {
        this.hive = hive;
        this.ref = ref;
        /*
            if (global.masters[this.ref])
              this.print("ERROR duplicate ref");
        */
        global.masters[this.ref] = this;
    }
    clearBees(beeArray) {
        // clear non-exisiting bees
        let deletedBees = false;
        _.forEach(beeArray, (bee, key) => {
            if (!global.bees[bee.ref]) {
                deletedBees = true;
                delete beeArray[key];
            }
        });
        if (deletedBees)
            beeArray = _.compact(beeArray);
        return beeArray;
    }
    print(info) {
        console.log(Game.time, "!", this.ref, "?", info);
    }
}

class minerMaster extends Master {
    constructor(resourceCell) {
        super(resourceCell.hive, "master_" + resourceCell.ref);
        this.miners = [];
        this.cell = resourceCell;
        this.lastSpawned = Game.time - CREEP_LIFE_TIME;
    }
    newBee(bee) {
        this.miners.push(bee);
        this.refreshLastSpawned();
    }
    refreshLastSpawned() {
        _.forEach(this.miners, (bee) => {
            let ticksToLive = bee.creep.ticksToLive ? bee.creep.ticksToLive : CREEP_LIFE_TIME;
            if (Game.time - (CREEP_LIFE_TIME - ticksToLive) >= this.lastSpawned)
                this.lastSpawned = Game.time - (CREEP_LIFE_TIME - ticksToLive);
        });
    }
    update() {
        this.miners = this.clearBees(this.miners);
        // 5 for random shit
        if (Game.time + 5 >= this.lastSpawned + CREEP_LIFE_TIME && (this.cell.link || this.cell.container)) {
            let order = {
                master: this.ref,
                setup: Setups.miner.energy,
                amount: 1,
                priority: 2,
            };
            this.lastSpawned = Game.time;
            this.hive.wish(order);
        }
    }
    run() {
        _.forEach(this.miners, (bee) => {
            if (bee.creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                bee.harvest(this.cell.source);
            }
            if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) >= 25) {
                let target;
                if (this.cell.link && this.cell.link.store.getFreeCapacity(RESOURCE_ENERGY))
                    target = this.cell.link;
                else if (this.cell.container && this.cell.container.store.getFreeCapacity(RESOURCE_ENERGY))
                    target = this.cell.container;
                if (target)
                    bee.transfer(target, RESOURCE_ENERGY);
            }
        });
    }
}

// cell that will extract energy or minerals? from ground
class resourceCell extends Cell {
    constructor(hive, source) {
        super(hive, "resourceCell_" + source.id);
        this.source = source;
        let container = _.filter(this.source.pos.findInRange(FIND_STRUCTURES, 2), (structure) => structure.structureType == STRUCTURE_CONTAINER)[0];
        if (container instanceof StructureContainer) {
            this.container = container;
        }
        let link = _.filter(this.source.pos.findInRange(FIND_MY_STRUCTURES, 2), (structure) => structure.structureType == STRUCTURE_LINK)[0];
        if (link instanceof StructureLink) {
            this.link = link;
        }
    }
    update() {
        super.update();
        {
            let sourceNew = Game.getObjectById(this.source.id);
            if (sourceNew instanceof Source || sourceNew instanceof Mineral)
                this.source = sourceNew;
        }
        if (!this.beeMaster)
            this.beeMaster = new minerMaster(this);
    }
    run() {
        if (this.link && this.hive.cells.storageCell && this.hive.cells.storageCell.link &&
            (this.link.store.getUsedCapacity(RESOURCE_ENERGY) >= this.hive.cells.storageCell.link.store.getCapacity(RESOURCE_ENERGY)
                - this.hive.cells.storageCell.inLink || this.link.store.getFreeCapacity(RESOURCE_ENERGY) <
                this.link.store.getCapacity(RESOURCE_ENERGY) * 0.15) && this.link.cooldown == 0) {
            this.link.transferEnergy(this.hive.cells.storageCell.link);
        }
    }
}

class haulerMaster extends Master {
    constructor(excavationCell) {
        super(excavationCell.hive, "master_" + excavationCell.ref);
        this.haulers = [];
        this.waitingForABee = 0;
        this.targetMap = {};
        this.cell = excavationCell;
        this.targetBeeCount = 0;
        _.forEach(this.cell.resourceCells, (cell) => {
            let beeForSource = 0;
            if (cell.container) {
                this.targetMap[cell.container.id] = null;
                if (this.hive.stage == 2)
                    beeForSource += 0.38;
                else
                    beeForSource += 0.55;
            }
            if (cell.link)
                beeForSource = 0;
            this.targetBeeCount += beeForSource;
        });
        this.targetBeeCount = Math.ceil(this.targetBeeCount);
    }
    newBee(bee) {
        this.haulers.push(bee);
        if (this.waitingForABee)
            this.waitingForABee -= 1;
    }
    update() {
        this.haulers = this.clearBees(this.haulers);
        _.forEach(this.targetMap, (ref, key) => {
            if (ref && key && !global.bees[ref])
                this.targetMap[key] = null;
        });
        if (this.haulers.length < this.targetBeeCount && !this.waitingForABee) {
            let order = {
                master: this.ref,
                setup: Setups.hauler,
                amount: this.targetBeeCount - this.haulers.length,
                priority: 4,
            };
            if (this.hive.stage < 2)
                order.setup.bodySetup.patternLimit = 10;
            this.waitingForABee += this.targetBeeCount - this.haulers.length;
            this.hive.wish(order);
        }
    }
    run() {
        // for future might be good to find closest bee for container and not the other way around
        if (this.hive.cells.storageCell) {
            let target = this.hive.cells.storageCell.storage;
            _.forEach(this.haulers, (bee) => {
                let ans;
                if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
                    let suckerTarget = _.filter(this.cell.quitefullContainers, (container) => this.targetMap[container.id] == bee.ref)[0];
                    if (!suckerTarget)
                        suckerTarget = _.filter(this.cell.quitefullContainers, (container) => this.targetMap[container.id] == null)[0];
                    if (suckerTarget) {
                        ans = bee.withdraw(suckerTarget, RESOURCE_ENERGY);
                        if (ans == OK)
                            this.targetMap[suckerTarget.id] = null;
                        else
                            this.targetMap[suckerTarget.id] = bee.ref;
                    }
                }
                if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 || ans == OK) {
                    bee.transfer(target, RESOURCE_ENERGY);
                }
            });
        }
    }
}

class excavationCell extends Cell {
    constructor(hive, sources) {
        super(hive, "excavationCell_" + hive.room.name);
        this.quitefullContainers = [];
        this.resourceCells = [];
        _.forEach(sources, (source) => {
            this.resourceCells.push(new resourceCell(this.hive, source));
        });
    }
    // first stage of decision making like do i a logistic transfer do i need more beeMasters
    update() {
        // super.update(); // i update containers in each resourceCell
        if (!this.beeMaster)
            this.beeMaster = new haulerMaster(this);
        this.quitefullContainers = [];
        _.forEach(this.resourceCells, (cell) => {
            cell.update();
            if (cell.container) {
                if (cell.container.store.getUsedCapacity(RESOURCE_ENERGY) >= 700)
                    this.quitefullContainers.push(cell.container);
            }
        });
        this.quitefullContainers.sort((a, b) => a.store.getFreeCapacity(RESOURCE_ENERGY) - b.store.getFreeCapacity(RESOURCE_ENERGY));
    }
    ;
    // second stage of decision making like where do i need to spawn creeps or do i need
    run() {
        _.forEach(this.resourceCells, (cell) => {
            cell.run();
        });
    }
    ;
}

class managerMaster extends Master {
    constructor(storageCell) {
        super(storageCell.hive, "master_" + storageCell.ref);
        this.managers = [];
        this.targets = [];
        this.suckerTargets = [];
        this.cell = storageCell;
        this.lastSpawned = Game.time - CREEP_LIFE_TIME;
    }
    newBee(bee) {
        this.managers.push(bee);
        this.refreshLastSpawned();
    }
    refreshLastSpawned() {
        _.forEach(this.managers, (bee) => {
            let ticksToLive = bee.creep.ticksToLive ? bee.creep.ticksToLive : CREEP_LIFE_TIME;
            if (Game.time - (CREEP_LIFE_TIME - ticksToLive) >= this.lastSpawned)
                this.lastSpawned = Game.time - (CREEP_LIFE_TIME - ticksToLive);
        });
    }
    update() {
        this.managers = this.clearBees(this.managers);
        // if order will matter (not a feature rn) i will like to put storage last
        this.targets = [this.cell.storage];
        this.suckerTargets = [this.cell.storage];
        if (this.hive.cells.defenseCell && this.hive.cells.defenseCell.towers.length)
            this.targets = this.targets.concat(this.hive.cells.defenseCell.towers);
        //if you don't need to withdraw => then it is not enough
        if (this.cell.link) {
            if (this.cell.link.store.getUsedCapacity(RESOURCE_ENERGY) - this.cell.inLink >= 25) {
                this.suckerTargets.push(this.cell.link);
            }
            else if ((this.cell.inLink - this.cell.link.store.getUsedCapacity(RESOURCE_ENERGY) >= 25
                || this.cell.inLink == this.cell.link.store.getCapacity(RESOURCE_ENERGY)))
                this.targets.push(this.cell.link);
        }
        // the >> is made by beatify cause >_> is better
        this.targets = _.filter(this.targets, (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
        // tragets.length cause dont need a manager for nothing
        if (Game.time >= this.lastSpawned + CREEP_LIFE_TIME && this.targets.length > 0) {
            let order = {
                master: this.ref,
                setup: Setups.manager,
                amount: 1,
                priority: 3,
            };
            if (this.hive.cells.storageCell && this.hive.cells.storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 100000)
                order.setup.bodySetup.patternLimit = 5; // save energy from burning
            this.lastSpawned = Game.time;
            this.hive.wish(order);
        }
    }
    run() {
        // TODO smarter choosing of target
        // aka draw energy if there is a target and otherwise put it back
        _.forEach(this.managers, (bee) => {
            let ans;
            if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0 && (this.targets.length > 1 || this.suckerTargets.length > 1)) {
                let suckerTarget = _.filter(this.suckerTargets, (structure) => structure.structureType == STRUCTURE_LINK)[0];
                if (!suckerTarget)
                    suckerTarget = _.filter(this.suckerTargets, (structure) => structure.structureType == STRUCTURE_STORAGE)[0];
                if (suckerTarget) {
                    if (suckerTarget instanceof StructureLink)
                        ans = bee.withdraw(suckerTarget, RESOURCE_ENERGY, Math.min(bee.creep.store.getFreeCapacity(RESOURCE_ENERGY), suckerTarget.store.getUsedCapacity(RESOURCE_ENERGY) - this.cell.inLink));
                    else
                        ans = bee.withdraw(suckerTarget, RESOURCE_ENERGY);
                }
            }
            else if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
                bee.goTo(this.cell.storage);
            }
            if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 || ans == OK) {
                // i cloud sort this.targets, but this is more convenient
                let target = _.filter(this.targets, (structure) => structure.structureType == STRUCTURE_TOWER &&
                    structure.store.getCapacity(RESOURCE_ENERGY) * 0.75 >= structure.store.getUsedCapacity(RESOURCE_ENERGY))[0];
                if (!target)
                    target = _.filter(this.targets, (structure) => structure.structureType == STRUCTURE_LINK)[0];
                if (!target)
                    target = _.filter(this.targets, (structure) => structure.structureType == STRUCTURE_TOWER)[0];
                if (!target)
                    target = _.filter(this.targets, (structure) => structure.structureType == STRUCTURE_STORAGE)[0];
                if (target)
                    if (target instanceof StructureLink)
                        ans = bee.transfer(target, RESOURCE_ENERGY, Math.min(bee.creep.store.getUsedCapacity(RESOURCE_ENERGY), this.cell.inLink - target.store.getUsedCapacity(RESOURCE_ENERGY)));
                    else
                        bee.transfer(target, RESOURCE_ENERGY);
            }
        });
    }
}

class storageCell extends Cell {
    constructor(hive, storage) {
        super(hive, "storageCell_" + hive.room.name);
        this.inLink = 0;
        this.linkRequests = {};
        this.storage = storage;
        let link = _.filter(this.storage.pos.findInRange(FIND_MY_STRUCTURES, 2), (structure) => structure.structureType == STRUCTURE_LINK)[0];
        if (link instanceof StructureLink) {
            this.link = link;
            this.inLink = LINK_CAPACITY * 0.5;
        }
    }
    update() {
        super.update();
        // check if manager is needed
        if (!this.beeMaster && this.hive.stage > 0 && (this.link || this.hive.cells.defenseCell))
            this.beeMaster = new managerMaster(this);
    }
    run() {
        if (this.link) {
            if (Object.keys(this.linkRequests).length) {
                let key = Object.keys(this.linkRequests)[0];
                let order = this.linkRequests[key];
                let tooBigOrder = order.amount && this.link.store.getUsedCapacity(RESOURCE_ENERGY) < order.amount
                    && order.amount <= this.link.store.getCapacity(RESOURCE_ENERGY);
                if (!this.link.cooldown && !tooBigOrder) {
                    this.link.transferEnergy(order.link, order.amount);
                    delete this.linkRequests[key];
                    // back to normal lvl of inLink
                    this.inLink = this.link.store.getCapacity(RESOURCE_ENERGY) * 0.5;
                }
                else if (tooBigOrder) {
                    // order.amount literally in tooBigOrder
                    this.inLink = order.amount;
                }
            }
            else {
                this.inLink = this.link.store.getCapacity(RESOURCE_ENERGY) * 0.5;
            }
        }
    }
}

class upgraderMaster extends Master {
    constructor(upgradeCell) {
        super(upgradeCell.hive, "master_" + upgradeCell.ref);
        this.upgraders = [];
        this.targetBeeCount = 1;
        this.waitingForABee = 0;
        this.cell = upgradeCell;
    }
    newBee(bee) {
        this.upgraders.push(bee);
        if (this.waitingForABee)
            this.waitingForABee -= 1;
    }
    update() {
        this.upgraders = this.clearBees(this.upgraders);
        if (this.hive.cells.storageCell) {
            // burn some energy on controller
            if (this.hive.cells.storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 150000)
                this.targetBeeCount = 2;
            else if (this.hive.cells.storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 900000)
                this.targetBeeCount = 3;
        }
        else
            this.targetBeeCount = 1;
        if (this.upgraders.length < this.targetBeeCount && !this.waitingForABee) {
            let order = {
                master: this.ref,
                setup: Setups.upgrader.manual,
                amount: this.targetBeeCount - this.upgraders.length,
                priority: 4,
            };
            if (this.cell.link || (this.hive.cells.storageCell
                && this.cell.controller.pos.getRangeTo(this.hive.cells.storageCell.storage) < 5)) {
                order.setup = Setups.upgrader.fast;
                if (this.hive.cells.storageCell && this.hive.cells.storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 50000)
                    order.setup.bodySetup.patternLimit = 0; // save energy from burning
            }
            this.waitingForABee += this.targetBeeCount - this.upgraders.length;
            this.hive.wish(order);
        }
    }
    run() {
        _.forEach(this.upgraders, (bee) => {
            if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
                let suckerTarget;
                if (this.cell.link)
                    suckerTarget = this.cell.link;
                if (!suckerTarget && this.hive.cells.storageCell)
                    suckerTarget = this.hive.cells.storageCell.storage;
                if (suckerTarget)
                    if (bee.withdraw(suckerTarget, RESOURCE_ENERGY) == OK)
                        bee.upgradeController(this.cell.controller);
            }
            else
                bee.upgradeController(this.cell.controller);
        });
    }
}

class upgradeCell extends Cell {
    constructor(hive, controller) {
        super(hive, "upgradeCell_" + hive.room.name);
        this.controller = controller;
        let link = _.filter(this.controller.pos.findInRange(FIND_MY_STRUCTURES, 3), (structure) => structure.structureType == STRUCTURE_LINK)[0];
        if (link instanceof StructureLink) {
            this.link = link;
        }
    }
    update() {
        super.update();
        if (!this.beeMaster)
            this.beeMaster = new upgraderMaster(this);
        if (this.link && this.link.store.getFreeCapacity(RESOURCE_ENERGY) > 50 &&
            this.hive.cells.storageCell) {
            this.hive.cells.storageCell.linkRequests[this.ref] = {
                link: this.link,
                amount: this.link.store.getFreeCapacity(RESOURCE_ENERGY),
            };
        }
    }
    run() {
    }
}

class defenseCell extends Cell {
    constructor(hive, towers) {
        super(hive, "defenseCell_" + hive.room.name);
        this.towers = towers;
    }
    // first stage of decision making like do i a logistic transfer do i need more beeMasters
    update() {
        super.update();
        // oh no towers fell guess time to safe mode
        //if (!this.towers.length && this.hive.stage > 0)
        //  this.hive.room.controller!.activateSafeMode();
    }
    ;
    // second stage of decision making like where do i need to spawn creeps or do i need
    run() {
        // #TODO better target picking
        if (this.hive.roomTargets) {
            let roomInfo = global.Apiary.intel.getInfo(this.hive.roomName);
            if (roomInfo) // i literally check here for hull wich is never -_-
                _.forEach(this.towers, (tower) => {
                    let closest = tower.pos.findClosestByRange(roomInfo.targetCreeps);
                    if (closest)
                        tower.attack(closest);
                });
        }
    }
    ;
}

function makeId(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() *
            charactersLength));
    }
    return result;
}

class queenMaster extends Master {
    constructor(respawnCell) {
        super(respawnCell.hive, "master_" + respawnCell.ref);
        this.queens = [];
        this.cell = respawnCell;
        this.lastSpawned = Game.time - CREEP_LIFE_TIME;
    }
    newBee(bee) {
        this.queens.push(bee);
        this.refreshLastSpawned();
    }
    refreshLastSpawned() {
        _.forEach(this.queens, (bee) => {
            let ticksToLive = bee.creep.ticksToLive ? bee.creep.ticksToLive : CREEP_LIFE_TIME;
            if (Game.time - (CREEP_LIFE_TIME - ticksToLive) >= this.lastSpawned)
                this.lastSpawned = Game.time - (CREEP_LIFE_TIME - ticksToLive);
        });
    }
    update() {
        this.queens = this.clearBees(this.queens);
        // 5 for random shit
        if (Game.time + 5 >= this.lastSpawned + CREEP_LIFE_TIME) {
            let order = {
                master: this.ref,
                setup: Setups.manager,
                amount: 1,
                priority: 0,
            };
            // can refill in 2.5 runs
            order.setup.bodySetup.patternLimit = Math.ceil(this.hive.room.energyCapacityAvailable / 2 / 50 / 2.5);
            this.lastSpawned = Game.time;
            this.hive.wish(order);
        }
    }
    run() {
        let targets = this.cell.spawns;
        targets = _.filter(targets.concat(this.cell.extensions), (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
        _.forEach(this.queens, (bee) => {
            if (targets.length) {
                let ans;
                if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
                    let suckerTarget;
                    if (!suckerTarget && this.hive.cells.storageCell)
                        suckerTarget = this.hive.cells.storageCell.storage;
                    if (suckerTarget)
                        ans = bee.withdraw(suckerTarget, RESOURCE_ENERGY);
                }
                if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 || ans == OK) {
                    let target = bee.creep.pos.findClosest(targets);
                    if (target)
                        bee.transfer(target, RESOURCE_ENERGY);
                }
            }
            else if (this.hive.cells.storageCell && bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0
                && this.hive.cells.storageCell.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                bee.transfer(this.hive.cells.storageCell.storage, RESOURCE_ENERGY);
            }
        });
    }
}

class respawnCell extends Cell {
    constructor(hive, spawns, extensions) {
        super(hive, "respawnCell_" + hive.room.name);
        this.freeSpawns = [];
        this.spawns = spawns;
        this.extensions = extensions;
    }
    // first stage of decision making like do i a logistic transfer do i need more beeMasters
    update() {
        super.update();
        // find free spawners
        this.freeSpawns = _.filter(this.spawns, (structure) => structure.spawning == null);
        if (!this.beeMaster && this.hive.stage > 0)
            this.beeMaster = new queenMaster(this);
    }
    ;
    // second stage of decision making like where do i need to spawn creeps or do i need
    run() {
        // generate the queue and start spawning
        let remove = [];
        this.hive.orderList.sort((a, b) => a.priority - b.priority);
        _.some(this.hive.orderList, (order, key) => {
            if (!this.freeSpawns.length)
                return true;
            if (order.amount <= 0 || !global.masters[order.master]) {
                remove.push(key);
            }
            else {
                let body;
                if (order.priority < 3)
                    body = order.setup.getBody(this.hive.room.energyAvailable);
                else
                    body = order.setup.getBody(this.hive.room.energyCapacityAvailable);
                // if we were able to get a body :/
                if (body.length) {
                    let spawn = this.freeSpawns.pop();
                    let name = order.setup.name + " " + makeId(4);
                    let memory = {
                        refMaster: order.master
                    };
                    let ans = spawn.spawnCreep(body, name, { memory: memory });
                    if (ans == ERR_NOT_ENOUGH_RESOURCES) {
                        return true;
                    }
                    if (ans == OK) {
                        Memory.log.spawns.push({
                                time: Game.time,
                                spawnRoom: this.hive.roomName,
                                fromSpawn: spawn.name,
                                spawning: order.setup.name,
                                orderedBy: order.master,
                            });
                        this.hive.orderList[key].amount -= 1;
                    }
                }
            }
            return false;
        });
        if (remove.length)
            _.forEach(remove.reverse(), (key) => {
                this.hive.orderList.splice(key, 1);
            });
    }
    ;
}

let maxSize = 6;
class bootstrapMaster extends Master {
    constructor(developmentCell) {
        super(developmentCell.hive, "master_" + developmentCell.ref);
        this.workers = [];
        this.targetBeeCount = 0;
        this.waitingForABee = 0;
        // some small caching. I just couldn't resist
        this.stateMap = {};
        this.sourceTargeting = {};
        this.cell = developmentCell;
        let workBodyParts = Math.min(maxSize, Math.floor(this.hive.room.energyCapacityAvailable / 200 / 3));
        _.forEach(this.cell.sources, (source) => {
            let walkablePositions = source.pos.getWalkablePositions().length;
            // 3000/300 /(workBodyParts * 2) / kk , where kk - how much of life will be wasted on harvesting (aka magic number)
            // how many creeps the source can support at a time: Math.min(walkablePositions, 10 / (workBodyParts * 2))
            if (source.room.name == this.hive.roomName)
                this.targetBeeCount += Math.min(walkablePositions, 10 / (workBodyParts * 2)) / 0.5;
            else
                this.targetBeeCount += Math.min(walkablePositions, 10 / (workBodyParts * 2)) / 0.666; // they need to walk more;
            this.sourceTargeting[source.id] = {
                max: walkablePositions,
                current: 0,
            };
        });
        this.targetBeeCount = Math.ceil(this.targetBeeCount);
    }
    newBee(bee) {
        bee.reusePath = 1;
        this.workers.push(bee);
        this.stateMap[bee.ref] = {
            type: "working",
            target: "",
        };
        if (this.waitingForABee)
            this.waitingForABee -= 1;
    }
    update() {
        this.workers = this.clearBees(this.workers);
        if (this.workers.length < this.targetBeeCount && !this.waitingForABee && this.hive.stage == 0) {
            let order = {
                master: this.ref,
                setup: Setups.builder,
                amount: 1,
                priority: 5,
            };
            order.setup.bodySetup.patternLimit = maxSize;
            this.waitingForABee += 1;
            if (this.workers.length < this.targetBeeCount * 0.5)
                order.priority = 2;
            this.hive.wish(order);
        }
    }
    run() {
        let count = {
            upgrade: 0,
            repair: 0,
            build: 0,
            refill: 0,
        };
        let sourceTargetingCurrent = {};
        _.forEach(this.cell.sources, (source) => {
            sourceTargetingCurrent[source.id] = 0;
        });
        _.forEach(this.workers, (bee) => {
            if (this.stateMap[bee.ref].type != "mining" && bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
                this.stateMap[bee.ref] = {
                    type: "mining",
                    target: "",
                };
                bee.creep.say('🔄');
            }
            if (this.stateMap[bee.ref].type == "mining" && bee.creep.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
                this.stateMap[bee.ref] = {
                    type: "working",
                    target: "",
                };
                bee.creep.say('🛠️');
            }
            if (this.stateMap[bee.ref].type == "mining") {
                let source;
                if (this.stateMap[bee.ref].target == "") {
                    // find new source
                    // next lvl caching would be to calculate all the remaining time to fill up and route to source and check on that
                    // but that is too much for too little
                    source = bee.creep.pos.findClosest(_.filter(this.cell.sources, (source) => this.sourceTargeting[source.id].current < this.sourceTargeting[source.id].max
                        && (source.pos.getOpenPositions().length || bee.creep.pos.isNearTo(source)) && source.energy > 0));
                    if (source) {
                        this.sourceTargeting[source.id].current += 1;
                        this.stateMap[bee.ref].target = source.id;
                    }
                }
                else {
                    source = Game.getObjectById(this.stateMap[bee.ref].target);
                }
                if (source) {
                    if (source.energy == 0)
                        this.stateMap[bee.ref].target = "";
                    else {
                        bee.harvest(source);
                        sourceTargetingCurrent[source.id] += 1;
                    }
                }
            }
            else {
                let target = Game.getObjectById(this.stateMap[bee.ref].target);
                let workType = this.stateMap[bee.ref].type;
                // checking if target is valid
                if (workType == "refill") {
                    workType = "working";
                    if ((target instanceof StructureSpawn || target instanceof StructureExtension || target instanceof StructureTower)
                        && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
                        workType = "refill";
                    // idk why it wont let me mesh it all in 1 if i guess couse storage can have more then energy
                    if ((target instanceof StructureStorage) && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
                        workType = "refill";
                }
                else if (workType == "repair") {
                    if (!(target instanceof Structure) || target.hits == target.hitsMax)
                        workType = "working";
                }
                if (workType == "working")
                    target = null;
                if (!target && this.cell.controller.ticksToDowngrade <= 2000 && count["upgrade"] == 0) {
                    target = this.cell.controller;
                    workType = "upgrade";
                }
                if (!target && this.hive.cells.respawnCell) {
                    let targets = this.hive.cells.respawnCell.spawns;
                    targets = _.filter(targets.concat(this.hive.cells.respawnCell.extensions), (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
                    if (targets.length) {
                        target = bee.creep.pos.findClosest(targets);
                        workType = "refill";
                    }
                }
                if (!target && this.hive.cells.defenseCell) {
                    let targets = _.filter(this.hive.cells.defenseCell.towers, (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
                    if (targets.length) {
                        target = bee.creep.pos.findClosest(targets);
                        workType = "refill";
                    }
                }
                if (!target && this.hive.cells.storageCell) {
                    target = this.hive.cells.storageCell.storage;
                    workType = "refill";
                }
                if (!target && count["build"] + count["repair"] <= Math.ceil(this.targetBeeCount * 0.75)) {
                    if (!target) {
                        target = bee.creep.pos.findClosest(this.hive.emergencyRepairs);
                        workType = "repair";
                    }
                    if (!target) {
                        target = bee.creep.pos.findClosest(this.hive.constructionSites);
                        workType = "build";
                    }
                }
                if (!target) {
                    target = this.cell.controller;
                    workType = "upgrade";
                }
                //second check is kinda useless one, but sure
                if (workType == "build" && target instanceof ConstructionSite)
                    bee.build(target);
                else if (workType == "repair" && target instanceof Structure)
                    bee.repair(target);
                else if (workType == "refill" && target instanceof Structure)
                    bee.transfer(target, RESOURCE_ENERGY);
                else if (workType == "upgrade" && target instanceof StructureController)
                    bee.upgradeController(target);
                else
                    workType = "working";
                count[workType] += 1;
                this.stateMap[bee.ref].type = workType;
                this.stateMap[bee.ref].target = target.id;
            }
        });
        _.forEach(sourceTargetingCurrent, (current, sourceId) => {
            this.sourceTargeting[sourceId].current = current;
        });
    }
}

class developmentCell extends Cell {
    constructor(hive, controller, sources) {
        super(hive, "developmentCell_" + hive.room.name);
        this.controller = controller;
        this.sources = sources;
    }
    update() {
        super.update();
        // caustom-made update for sources for developmentCell
        _.forEach(this.sources, (source, key) => {
                let sourceNew = Game.getObjectById(source.id);
                if (sourceNew instanceof Source)
                    this.sources[key] = sourceNew;
            });
        if (!this.beeMaster)
            this.beeMaster = new bootstrapMaster(this);
        // delete when reached state of storage? rn it will just fade with vr recreation
    }
    run() { }
}

class builderMaster extends Master {
    constructor(hive) {
        super(hive, "master_" + "builderHive_" + hive.room.name);
        this.builders = [];
        this.targetBeeCount = 1;
        this.waitingForABee = 0;
        this.targetCaching = {};
    }
    newBee(bee) {
        this.builders.push(bee);
        this.targetCaching[bee.ref] = "";
        if (this.waitingForABee)
            this.waitingForABee -= 1;
    }
    update() {
        this.builders = this.clearBees(this.builders);
        // TODO smarter counting of builders needed
        let targetsNumber = this.hive.emergencyRepairs.length + this.hive.constructionSites.length;
        if (targetsNumber > 5 && this.hive.cells.storageCell
            && this.hive.cells.storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 100000) {
            this.targetBeeCount = 2;
        }
        else {
            this.targetBeeCount = 1;
        }
        if (targetsNumber && this.builders.length < this.targetBeeCount && !this.waitingForABee) {
            let order = {
                master: this.ref,
                setup: Setups.builder,
                amount: this.targetBeeCount - this.builders.length,
                priority: 4,
            };
            this.waitingForABee += this.targetBeeCount - this.builders.length;
            this.hive.wish(order);
        }
    }
    run() {
        _.forEach(this.builders, (bee) => {
            let ans = ERR_FULL;
            if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0 && this.hive.cells.storageCell) {
                ans = bee.withdraw(this.hive.cells.storageCell.storage, RESOURCE_ENERGY);
                this.targetCaching[bee.ref] = "";
            }
            if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 || ans == OK) {
                let target = Game.getObjectById(this.targetCaching[bee.ref]);
                if (target instanceof Structure && target.hits == target.hitsMax)
                    target = null;
                if (!target)
                    target = bee.creep.pos.findClosest(this.hive.emergencyRepairs);
                if (!target)
                    target = bee.creep.pos.findClosest(this.hive.constructionSites);
                if (!target)
                    target = bee.creep.pos.findClosest(this.hive.normalRepairs);
                if (target) {
                    if (target instanceof ConstructionSite)
                        bee.build(target);
                    else if (target instanceof Structure)
                        bee.repair(target);
                    this.targetCaching[bee.ref] = target.id;
                }
            }
        });
    }
}

class annexMaster extends Master {
    constructor(hive, controller) {
        super(hive, "master_" + "annexerRoom_" + controller.room.name);
        this.claimers = [];
        this.controller = controller;
        this.lastSpawned = Game.time - CREEP_CLAIM_LIFE_TIME;
    }
    newBee(bee) {
        this.claimers.push(bee);
        this.refreshLastSpawned();
    }
    refreshLastSpawned() {
        _.forEach(this.claimers, (bee) => {
            let ticksToLive = bee.creep.ticksToLive ? bee.creep.ticksToLive : CREEP_LIFE_TIME;
            if (Game.time - (CREEP_CLAIM_LIFE_TIME - ticksToLive) >= this.lastSpawned)
                this.lastSpawned = Game.time - (CREEP_CLAIM_LIFE_TIME - ticksToLive);
        });
    }
    update() {
        this.claimers = this.clearBees(this.claimers);
        {
            let controller = Game.getObjectById(this.controller.id);
            if (controller)
                this.controller = controller;
        }
        // 5 for random shit
        if (Game.time + 5 >= this.lastSpawned + CREEP_CLAIM_LIFE_TIME) {
            let order = {
                master: this.ref,
                setup: Setups.claimer,
                amount: 1,
                priority: 2,
            };
            let controller = Game.getObjectById(this.controller.id);
            if (controller)
                this.controller = controller;
            // 4200 - funny number)) + somewhat close to theoretically optimal 5000-600
            if (this.controller && this.controller.reservation && this.controller.reservation.ticksToEnd >= 4200)
                order.setup.bodySetup.patternLimit = 1; //make smaller if not needed
            this.hive.wish(order);
            // well he placed an order now just need to catch a creep after a spawn
            this.lastSpawned = Game.time;
        }
    }
    run() {
        _.forEach(this.claimers, (bee) => {
            bee.reserveController(this.controller);
        });
    }
}

class puppetMaster extends Master {
    constructor(hive, annexName) {
        super(hive, "master_" + "puppetFor_" + annexName);
        this.puppets = [];
        this.waitingForABee = 0;
        this.target = new RoomPosition(25, 25, annexName);
    }
    newBee(bee) {
        this.puppets.push(bee);
        if (this.waitingForABee)
            this.waitingForABee = 0;
    }
    update() {
        this.puppets = this.clearBees(this.puppets);
        // 5 for random shit
        if (this.puppets.length == 0 && !this.waitingForABee && !Game.rooms[this.target.roomName]) {
            let order = {
                master: this.ref,
                setup: Setups.puppet,
                amount: 1,
                priority: 1,
            };
            this.waitingForABee = 1;
            this.hive.wish(order);
        }
    }
    run() {
        if (Game.rooms[this.target.roomName]) {
            // for now will recreate everything
            global.Apiary.destroyTime = Game.time + 10;
        }
        _.forEach(this.puppets, (bee) => {
            if (bee.creep.pos.getRangeTo(this.target) > 10)
                bee.goTo(this.target);
        });
    }
}

var _a, _b;
class repairSheet {
    constructor(hiveStage) {
        this[_a] = 200000;
        this[_b] = 200000;
        this.other = 1;
        this.collapse = 0.5;
        if (hiveStage == 0) {
            this[STRUCTURE_RAMPART] = 20000;
            this[STRUCTURE_WALL] = 20000;
            this.other = 0.7;
            this.collapse = 0.3;
        }
        else if (hiveStage == 2) {
            this[STRUCTURE_RAMPART] = 2000000;
            this[STRUCTURE_WALL] = 2000000;
            this.other = 1;
            this.collapse = 0.7;
        }
    }
    isAnEmergency(structure) {
        switch (structure.structureType) {
            case STRUCTURE_RAMPART:
            case STRUCTURE_WALL: {
                return structure.hits < this[structure.structureType] * this.collapse;
            }
            default: {
                return structure.hits < structure.hitsMax * this.other * this.collapse;
            }
        }
    }
    isAnRepairCase(structure) {
        switch (structure.structureType) {
            case STRUCTURE_RAMPART:
            case STRUCTURE_WALL: {
                return structure.hits < this[structure.structureType];
            }
            default: {
                return structure.hits < structure.hitsMax * this.other;
            }
        }
    }
}
_a = STRUCTURE_RAMPART, _b = STRUCTURE_WALL;
class Hive {
    constructor(roomName, annexNames) {
        this.annexes = []; // this room and annexes
        this.rooms = []; //this room and annexes
        this.orderList = [];
        //targets for defense systems
        this.roomTargets = false;
        this.annexesTargets = false;
        // some structures (aka preprocess of filters)
        this.constructionSites = [];
        this.emergencyRepairs = [];
        this.normalRepairs = [];
        this.claimers = [];
        this.puppets = [];
        this.stage = 0;
        this.roomName = roomName;
        this.annexNames = annexNames;
        this.room = Game.rooms[roomName];
        this.updateRooms();
        this.cells = {};
        this.parseStructures();
        this.repairSheet = new repairSheet(this.stage);
        if (this.stage > 0)
            this.builder = new builderMaster(this);
        this.updateConstructionSites();
        this.updateEmeregcyRepairs();
        this.updateNormalRepairs();
        this.findTargets();
    }
    updateRooms() {
        this.room = Game.rooms[this.roomName];
        this.annexes = _.compact(_.map(this.annexNames, (annexName) => {
            let annex = Game.rooms[annexName];
            if (!annex && !global.masters["master_puppetFor_" + annexName])
                this.puppets.push(new puppetMaster(this, annexName));
            else if (annex && annex.controller && this.room.energyCapacityAvailable >= 650
                && !global.masters["master_annexerRoom_" + annexName])
                this.claimers.push(new annexMaster(this, annex.controller));
            return annex;
        }));
        this.rooms = [this.room].concat(this.annexes);
    }
    parseStructures() {
        let spawns = [];
        let extensions = [];
        let towers = [];
        _.forEach(this.room.find(FIND_MY_STRUCTURES), (structure) => {
            if (structure instanceof StructureSpawn && structure.isActive())
                spawns.push(structure);
            else if (structure instanceof StructureExtension && structure.isActive())
                extensions.push(structure);
            else if (structure instanceof StructureTower && structure.isActive())
                towers.push(structure);
        });
        let storage = this.room.storage && this.room.storage.isActive() ? this.room.storage : undefined;
        let allSources = [];
        _.forEach(this.rooms, (room) => {
            let sources = room.find(FIND_SOURCES);
            allSources = allSources.concat(sources);
        });
        this.cells.respawnCell = new respawnCell(this, spawns, extensions);
        if (storage) {
            this.cells.storageCell = new storageCell(this, storage);
            if (storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) {
                this.stage = 1;
                this.cells.upgradeCell = new upgradeCell(this, this.room.controller);
                if (allSources.length) {
                    this.cells.excavationCell = new excavationCell(this, allSources);
                }
            }
        }
        if (this.stage == 0) {
            this.cells.developmentCell = new developmentCell(this, this.room.controller, allSources);
        }
        if (towers.length) {
            this.cells.defenseCell = new defenseCell(this, towers);
        }
    }
    updateConstructionSites() {
        this.constructionSites = [];
        _.forEach(this.rooms, (room) => {
            this.constructionSites = this.constructionSites.concat(room.find(FIND_CONSTRUCTION_SITES));
        });
    }
    updateEmeregcyRepairs() {
        this.emergencyRepairs = [];
        _.forEach(this.rooms, (room) => {
            this.emergencyRepairs = this.emergencyRepairs.concat(_.filter(room.find(FIND_STRUCTURES), (structure) => this.repairSheet.isAnEmergency(structure)));
        });
    }
    updateNormalRepairs() {
        this.normalRepairs = [];
        _.forEach(this.rooms, (room) => {
            this.normalRepairs = this.normalRepairs.concat(_.filter(room.find(FIND_STRUCTURES), (structure) => this.repairSheet.isAnRepairCase(structure)));
        });
    }
    // look for targets inside room
    findTargets() {
        this.roomTargets = this.room.find(FIND_HOSTILE_CREEPS).length ? true : false;
        _.some(this.annexes, (room) => {
            let annexTargets = room.find(FIND_HOSTILE_CREEPS);
            if (annexTargets.length > 0) {
                if (!Game.flags["defend_" + room.name])
                    annexTargets[0].pos.createFlag("defend_" + room.name, COLOR_RED, COLOR_BLUE);
                if (!this.annexesTargets)
                    this.annexesTargets = annexTargets.length > 0;
            }
        });
    }
    // add to list a new creep
    wish(order) {
        // add some checks
        this.orderList.push(order);
    }
    update() {
        {
            this.updateRooms();
        }
        {
            this.updateConstructionSites();
            this.updateEmeregcyRepairs();
            this.updateNormalRepairs();
        }
        {
            this.findTargets();
        }
        _.forEach(this.cells, (cell) => {
            cell.update();
        });
    }
    run() {
        _.forEach(this.cells, (cell) => {
            cell.run();
        });
    }
}

class Bee {
    // for now it will be forever binded
    constructor(creep) {
        this.reusePath = 3;
        this.creep = creep;
        this.master = global.masters[this.creep.memory.refMaster];
        this.ref = creep.name;
        // not sure weather i should copy all parameters from creep like body and stuff
        global.bees[this.creep.name] = this;
    }
    // for future: could path to open position near object for targets that require isNearTo
    // but is it worh in terms of CPU?
    print(info) {
        console.log(Game.time, "!", this.creep.name, "?", info);
    }
    attack(target) {
        if (this.creep.pos.isNearTo(target))
            this.creep.attack(target);
        else
            this.goTo(target);
        return ERR_NOT_IN_RANGE;
    }
    harvest(target) {
        if (this.creep.pos.isNearTo(target))
            this.creep.harvest(target);
        else
            this.goTo(target);
        return ERR_NOT_IN_RANGE;
    }
    transfer(target, resourceType, amount) {
        if (this.creep.pos.isNearTo(target))
            return this.creep.transfer(target, resourceType, amount);
        else
            this.goTo(target);
        return ERR_NOT_IN_RANGE;
    }
    withdraw(target, resourceType, amount) {
        if (this.creep.pos.isNearTo(target))
            return this.creep.withdraw(target, resourceType, amount);
        else
            this.goTo(target);
        return ERR_NOT_IN_RANGE;
    }
    build(target) {
        if (this.creep.pos.getRangeTo(target.pos) <= 3)
            return this.creep.build(target);
        else
            this.goTo(target);
        return ERR_NOT_IN_RANGE;
    }
    repair(target) {
        if (this.creep.pos.getRangeTo(target.pos) <= 3)
            return this.creep.repair(target);
        else
            this.goTo(target);
        return ERR_NOT_IN_RANGE;
    }
    upgradeController(target) {
        if (this.creep.pos.getRangeTo(target.pos) <= 3)
            return this.creep.upgradeController(target);
        else
            this.goTo(target);
        return ERR_NOT_IN_RANGE;
    }
    reserveController(target) {
        if (this.creep.pos.isNearTo(target))
            return this.creep.reserveController(target);
        else
            this.goTo(target);
        return ERR_NOT_IN_RANGE;
    }
    attackController(target) {
        if (this.creep.pos.isNearTo(target))
            return this.creep.attackController(target);
        else
            this.goTo(target);
        return ERR_NOT_IN_RANGE;
    }
    goTo(target) {
        this.creep.travelTo(target, {});
    }
    goToRoom(roomName) {
        this.goTo(new RoomPosition(25, 25, roomName));
    }
}

// same as goverment intelligence
class Intel {
    constructor() {
        this.roomInfo = {};
    }
    getInfo(roomName) {
        if (!this.roomInfo[roomName]) {
            this.roomInfo[roomName] = {
                lastUpdated: 0,
                targetCreeps: [],
                targetBuildings: [],
                safeToDowngrade: false,
            };
        }
        if (this.roomInfo[roomName].lastUpdated == Game.time)
            return this.roomInfo[roomName];
        if (!(roomName in Game.rooms))
            return {
                    lastUpdated: 0,
                    targetCreeps: [],
                    targetBuildings: [],
                    safeToDowngrade: false,
                };
        let room = Game.rooms[roomName];
        this.updateRoom(room);
        return this.roomInfo[roomName];
    }
    updateRoom(room) {
        this.roomInfo[room.name].lastUpdated = Game.time;
        this.roomInfo[room.name].targetBuildings = room.find(FIND_HOSTILE_STRUCTURES, {
            filter: (structure) => structure.structureType == STRUCTURE_TOWER ||
                structure.structureType == STRUCTURE_INVADER_CORE
        });
        this.roomInfo[room.name].targetCreeps = _.filter(room.find(FIND_HOSTILE_CREEPS), (creep) => creep.getBodyparts(HEAL));
        if (!this.roomInfo[room.name].targetCreeps.length)
            this.roomInfo[room.name].targetCreeps = _.filter(room.find(FIND_HOSTILE_CREEPS), (creep) => creep.getBodyparts(ATTACK));
        if (!this.roomInfo[room.name].targetBuildings.length && !this.roomInfo[room.name].targetCreeps.length)
            this.roomInfo[room.name].targetBuildings = room.find(FIND_HOSTILE_STRUCTURES, {
                filter: (structure) => structure.structureType == STRUCTURE_SPAWN ||
                    structure.structureType == STRUCTURE_POWER_SPAWN
            });
        if (!this.roomInfo[room.name].targetBuildings.length && !this.roomInfo[room.name].targetCreeps.length) {
            // time to pillage
            this.roomInfo[room.name].targetBuildings = room.find(FIND_HOSTILE_STRUCTURES, {
                filter: (structure) => structure.structureType == STRUCTURE_RAMPART ||
                    structure.structureType == STRUCTURE_EXTENSION
            });
            this.roomInfo[room.name].targetCreeps = _.filter(room.find(FIND_HOSTILE_CREEPS));
            this.roomInfo[room.name].safeToDowngrade = true;
        }
    }
}

// new fancy war ai master
class SwarmMaster extends Master {
    constructor(hive, order) {
        super(hive, "master_Swarm_" + order.name);
        this.destroyTime = Game.time + 3000;
        this.order = order;
    }
}

// most basic of bitches a horde full of wasps
class hordeMaster extends SwarmMaster {
    constructor(hive, order) {
        super(hive, order);
        this.knights = [];
        this.waitingForABee = 0;
        // failsafe
        this.maxSpawns = 500;
        this.spawned = 0;
        this.tryToDowngrade = false;
        this.targetBeeCount = 1;
    }
    newBee(bee) {
        this.knights.push(bee);
        if (this.waitingForABee)
            this.waitingForABee -= 1;
    }
    update() {
        this.knights = this.clearBees(this.knights);
        let targetsAlive = true;
        let roomInfo = global.Apiary.intel.getInfo(this.order.pos.roomName);
        if (roomInfo && (roomInfo.targetCreeps.length + roomInfo.targetBuildings.length) == 0)
            targetsAlive = false;
        if (targetsAlive && this.destroyTime < Game.time + CREEP_LIFE_TIME && this.spawned < this.maxSpawns)
            this.destroyTime = Game.time + CREEP_LIFE_TIME + 1;
        if (this.knights.length < this.targetBeeCount && !this.waitingForABee &&
            this.destroyTime > Game.time + CREEP_LIFE_TIME && this.spawned < this.maxSpawns) {
            let order = {
                master: this.ref,
                setup: Setups.knight,
                amount: this.targetBeeCount - this.knights.length,
                priority: 1,
            };
            if (this.targetBeeCount - this.knights.length == 1 && this.targetBeeCount > 1)
                order.priority = 5;
            this.waitingForABee += this.targetBeeCount - this.knights.length;
            this.spawned += this.targetBeeCount - this.knights.length;
            this.hive.wish(order);
        }
    }
    run() {
        // it is cached after first check
        let roomInfo = global.Apiary.intel.getInfo(this.order.pos.roomName);
        if (this.tryToDowngrade && roomInfo.safeToDowngrade && this.order.pos.roomName in Game.rooms) {
            let room = Game.rooms[this.order.pos.roomName];
            if (room.controller && !room.controller.my && room.controller.owner) {
                if (!room.controller.pos.lookFor(LOOK_FLAGS).length)
                    room.controller.pos.createFlag("downgrade_" + room.name, COLOR_RED, COLOR_PURPLE);
                this.tryToDowngrade = false;
            }
        }
        this.print(roomInfo);
        let enemyTargetingCurrent = {};
        _.forEach(roomInfo.targetBuildings.concat(roomInfo.targetCreeps), (enemy) => {
            enemyTargetingCurrent[enemy.id] = {
                current: 0,
                max: enemy.pos.getOpenPositions().length,
            };
        });
        _.forEach(this.knights, (bee) => {
            if (bee.creep.room.name != this.order.pos.roomName) {
                bee.goTo(this.order.pos);
            }
            else {
                bee.print("here1");
                let target = bee.creep.pos.findClosest(_.filter(roomInfo.targetBuildings, (structure) => enemyTargetingCurrent[structure.id].current < enemyTargetingCurrent[structure.id].max));
                if (!target)
                    target = bee.creep.pos.findClosest(_.filter(roomInfo.targetCreeps, (creep) => enemyTargetingCurrent[creep.id].current < enemyTargetingCurrent[creep.id].max));
                bee.print(target);
                if (target) {
                    bee.attack(target);
                    enemyTargetingCurrent[target.id].current += 1;
                }
                else {
                    if (!bee.creep.pos.isNearTo(this.order.pos))
                        bee.goTo(this.order.pos);
                }
            }
        });
    }
}

class downgradeMaster extends SwarmMaster {
    constructor(hive, order) {
        super(hive, order);
        this.claimers = [];
        this.lastSpawned = Game.time - CONTROLLER_ATTACK_BLOCKED_UPGRADE;
        this.lastAttacked = Game.time - CONTROLLER_ATTACK_BLOCKED_UPGRADE;
    }
    newBee(bee) {
        this.claimers.push(bee);
        this.refreshLastSpawned();
    }
    refreshLastSpawned() {
        _.forEach(this.claimers, (bee) => {
            let ticksToLive = bee.creep.ticksToLive ? bee.creep.ticksToLive : CREEP_LIFE_TIME;
            if (Game.time - (CREEP_CLAIM_LIFE_TIME - ticksToLive) >= this.lastSpawned)
                this.lastSpawned = Game.time - (CREEP_CLAIM_LIFE_TIME - ticksToLive);
        });
    }
    update() {
        this.claimers = this.clearBees(this.claimers);
        let room = Game.rooms[this.order.pos.roomName];
        if (room)
            if (room.controller) {
                if (!room.controller.my && !room.controller.owner)
                    this.destroyTime = Game.time;
                else if (room.controller.safeMode) // wait untill safe mode run out
                    this.lastAttacked = Game.time + room.controller.safeMode - CONTROLLER_ATTACK_BLOCKED_UPGRADE;
            }
            else {
                this.destroyTime = Game.time;
            }
        if (Game.time > this.lastAttacked + CONTROLLER_ATTACK_BLOCKED_UPGRADE && Game.time != this.destroyTime)
            this.destroyTime = Game.time + CONTROLLER_ATTACK_BLOCKED_UPGRADE; // if no need to destroy i will add time
        // 5 for random shit
        if (Game.time - this.lastSpawned >= CONTROLLER_ATTACK_BLOCKED_UPGRADE && this.destroyTime > Game.time + 100) {
            let order = {
                master: this.ref,
                setup: Setups.claimer,
                amount: 1,
                priority: 5,
            };
            order.setup.bodySetup.patternLimit = 1; //main idea - block upgrading
            this.hive.wish(order);
            this.lastSpawned = Game.time;
        }
    }
    run() {
        _.forEach(this.claimers, (bee) => {
            if (!bee.creep.pos.isNearTo(this.order.pos))
                bee.goTo(this.order.pos);
            else if (Game.time >= this.lastAttacked + CONTROLLER_ATTACK_BLOCKED_UPGRADE) {
                let room = Game.rooms[this.order.pos.roomName];
                if (room && room.controller && !room.controller.my && room.controller.owner) {
                    let roomInfo = global.Apiary.intel.getInfo(this.order.pos.roomName);
                    if (!Game.flags["attack_" + room.name] && roomInfo.targetCreeps.length + roomInfo.targetBuildings.length)
                        roomInfo.targetCreeps[0].pos.createFlag("attack_" + room.name, COLOR_RED, COLOR_RED);
                    let ans = bee.attackController(room.controller);
                    if (ans == OK)
                        this.lastAttacked = Game.time;
                    else if (ans == ERR_TIRED)
                        this.lastAttacked = Game.time - CONTROLLER_ATTACK_BLOCKED_UPGRADE / 2; // not sure what to DO if reboot and it is tired
                }
            }
        });
    }
}

class _Apiary {
    constructor() {
        this.hives = {};
        this.destroyTime = Game.time + 4000;
        this.intel = new Intel();
        let myRoomsAnnexes = {};
        _.forEach(Game.rooms, (room) => {
            if (room.controller && room.controller.my)
                myRoomsAnnexes[room.name] = [];
        });
        _.forEach(Game.flags, (flag) => {
            // annex room
            if (flag.color == COLOR_PURPLE && flag.secondaryColor == COLOR_PURPLE) {
                _.some(Game.map.describeExits(flag.pos.roomName), (exit) => {
                    if (exit && myRoomsAnnexes[exit] && !myRoomsAnnexes[exit].includes(flag.pos.roomName)) {
                        myRoomsAnnexes[exit].push(flag.pos.roomName);
                        return true;
                    }
                    return false;
                });
            }
        });
        _.forEach(myRoomsAnnexes, (annexNames, roomName) => {
            if (roomName)
                this.hives[roomName] = new Hive(roomName, annexNames);
        });
    }
    spawnSwarm(order, swarmMaster) {
        let homeRoom = Object.keys(this.hives)[Math.floor(Math.random() * Object.keys(this.hives).length)];
        _.forEach(Game.map.describeExits(order.pos.roomName), (exit) => {
            if (this.hives[exit] && this.hives[homeRoom].stage > this.hives[exit].stage)
                homeRoom = exit;
        });
        return new swarmMaster(this.hives[homeRoom], order);
    }
    updateFlags() {
        // act upon flags
        if (Object.keys(this.hives).length)
            _.forEach(Game.flags, (flag) => {
                // annex room
                if (flag.color == COLOR_RED) {
                    let master = global.masters["master_Swarm_" + flag.name];
                    if (!master) {
                        if (flag.secondaryColor == COLOR_BLUE)
                            this.spawnSwarm(flag, hordeMaster);
                        else if (flag.secondaryColor == COLOR_RED) {
                            let masterNew = this.spawnSwarm(flag, hordeMaster);
                            // change settings to fit needed parameters
                            _.some(Game.map.describeExits(flag.pos.roomName), (exit) => {
                                if (this.hives[exit])
                                    masterNew.tryToDowngrade = true;
                                return masterNew.tryToDowngrade;
                            });
                            masterNew.targetBeeCount = 2;
                            masterNew.maxSpawns = masterNew.targetBeeCount * 2;
                        }
                        else if (flag.secondaryColor == COLOR_PURPLE)
                            this.spawnSwarm(flag, downgradeMaster);
                    }
                    else if (master.destroyTime < Game.time) {
                        delete global.masters["master_Swarm_" + flag.name];
                        flag.remove();
                    }
                    else {
                        master.order = flag;
                    }
                }
            });
    }
    updateBees() {
        // after all the masters where created and retrived if it was needed
        for (const name in Memory.creeps) {
            let creep = Game.creeps[name];
            if (creep)
                if (!global.bees[name]) {
                    if (global.masters[creep.memory.refMaster]) {
                        // not sure if i rly need a global bees hash
                        global.bees[creep.name] = new Bee(creep);
                        global.masters[creep.memory.refMaster].newBee(global.bees[creep.name]);
                    }
                    else if (creep.memory.refMaster.includes("master_developmentCell_")) {
                        // TODO think of something smart
                        let randomMaster = Object.keys(global.masters)[Math.floor(Math.random() * Object.keys(global.masters).length)];
                        creep.memory.refMaster = randomMaster;
                        global.bees[creep.name] = new Bee(creep);
                        global.masters[creep.memory.refMaster].newBee(global.bees[creep.name]);
                    }
                    // idk what to do if i lost a master to the bee. I guess the bee is just FUCKED for now
                }
                else {
                    // i guess it is not gonna be fixed :/
                    global.bees[name].creep = creep;
                }
            else if (global.bees[name])
                delete global.bees[name];
        }
    }
    // update phase
    update() {
        _.forEach(this.hives, (hive) => {
            hive.update();
        });
        this.updateFlags();
        this.updateBees();
        _.forEach(global.masters, (master) => {
            master.update();
        });
    }
    // run phase
    run() {
        _.forEach(this.hives, (hive) => {
            hive.run();
        });
        _.forEach(global.masters, (master) => {
            master.run();
        });
    }
}

// This gets run on each global reset
function onGlobalReset() {
    // check if all memory position were created
    Mem.init();
    Memory.log.reset = Game.time;
    console.log("Reset? Cool time is", Game.time);
    global.bees = {};
    global.masters = {};
    delete global.Apiary;
    global.Apiary = new _Apiary();
}
function main() {
    if (!global.Apiary || Game.time >= global.Apiary.destroyTime) {
        onGlobalReset();
    }
    global.Apiary.update();
    global.Apiary.run();
    // Automatically delete memory
    Mem.clean();
}
// time to wrap things up
let _loop = main;
{
    _loop = ErrorMapper.wrapLoop(main);
}
const loop = _loop;
onGlobalReset();

exports.loop = loop;
//# sourceMappingURL=main.js.map
