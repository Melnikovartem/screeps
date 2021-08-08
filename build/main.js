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
    }
    static clean() {
        for (const creepName in Memory.creeps) {
            if (!(creepName in Game.creeps)) {
                delete Memory.creeps[creepName];
            }
        }
    }
}

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
RoomPosition.prototype.getOpenPositions = function () {
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
RoomPosition.prototype.findClosest = function (structures) {
    // TODO if structure is in another room
    return this.findClosestByRange(structures);
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
                this[key] = Game.getObjectById(data.id);
            }
            else if (Array.isArray(data) && data[0] instanceof Structure) {
                let new_data = [];
                _.forEach(data, (structure) => {
                    new_data.push(Game.getObjectById(structure.id));
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
        if (this.bodySetup.patternLimit)
            limitSegments = this.bodySetup.patternLimit;
        let maxSegment = Math.min(limitSegments, Math.floor((energy - fixedCosts) / segmentCost));
        _.forEach(this.bodySetup.pattern, (s) => _.times(maxSegment, () => body.push(s)));
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
};
const Setups = {
    starter: new CreepSetup(SetupsNames.starter, {
        pattern: [WORK, CARRY, MOVE],
    }),
    claimer: new CreepSetup(SetupsNames.claimer, {
        pattern: [CLAIM, MOVE],
        patternLimit: 2,
    }),
    manager: {
        small: new CreepSetup(SetupsNames.manager, {
            pattern: [CARRY, CARRY, MOVE],
            patternLimit: 5,
        }),
        normal: new CreepSetup(SetupsNames.manager, {
            pattern: [CARRY, CARRY, MOVE],
            patternLimit: 15,
        }),
    },
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
    upgrader: new CreepSetup(SetupsNames.upgrader, {
        fixed: [WORK, CARRY, MOVE],
        pattern: [WORK, WORK, MOVE],
        patternLimit: 6,
    }),
    builder: new CreepSetup(SetupsNames.builder, {
        pattern: [WORK, CARRY, MOVE],
    }),
};

// import { makeId } from "../utils/other"
// i will need to do something so i can build up structure from memory
class Master {
    constructor(hive, ref) {
        this.hive = hive;
        this.ref = ref;
        global.masters[this.ref] = this;
        //this.updateCash(['hive', 'ref']);
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
        this.refreshLastSpawned();
    }
    newBee(bee) {
        this.miners.push(bee);
        this.refreshLastSpawned();
    }
    refreshLastSpawned() {
        _.forEach(this.miners, (bee) => {
            if (bee.creep.ticksToLive && Game.time - bee.creep.ticksToLive >= this.lastSpawned)
                this.lastSpawned = Game.time - bee.creep.ticksToLive;
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
            };
            this.lastSpawned = Game.time;
            this.hive.wish(order);
        }
    }
    ;
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
    ;
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
        if (!this.beeMaster)
            this.beeMaster = new minerMaster(this);
        if (this.container && this.container.store.getUsedCapacity() >= 200) ;
    }
    run() {
        if (this.link && this.hive.cells.storageCell && this.hive.cells.storageCell.link &&
            this.link.store.getUsedCapacity(RESOURCE_ENERGY) >= this.link.store.getCapacity(RESOURCE_ENERGY)
                - this.hive.cells.storageCell.inLink && this.link.cooldown == 0) {
            this.link.transferEnergy(this.hive.cells.storageCell.link);
        }
    }
}

class excavationCell extends Cell {
    constructor(hive, sources) {
        super(hive, "excavationCell_" + hive.room.name);
        this.resourceCells = [];
        _.forEach(sources, (source) => {
            this.resourceCells.push(new resourceCell(this.hive, source));
        });
    }
    // first stage of decision making like do i a logistic transfer do i need more beeMasters
    update() {
        super.update();
        _.forEach(this.resourceCells, (cell) => {
            cell.update();
        });
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
        this.refreshLastSpawned();
    }
    newBee(bee) {
        this.managers.push(bee);
        this.refreshLastSpawned();
    }
    refreshLastSpawned() {
        _.forEach(this.managers, (bee) => {
            if (bee.creep.ticksToLive && Game.time - bee.creep.ticksToLive >= this.lastSpawned)
                this.lastSpawned = Game.time - bee.creep.ticksToLive;
        });
    }
    update() {
        this.managers = this.clearBees(this.managers);
        this.targets = [];
        this.suckerTargets = [this.cell.storage];
        if (this.hive.cells.defenseCell && this.hive.cells.defenseCell.towers.length)
            this.targets = this.targets.concat(this.hive.cells.defenseCell.towers);
        //if you don't need to withdraw => then it is not enough
        if (this.cell.link) {
            if (this.cell.link.store.getUsedCapacity(RESOURCE_ENERGY) > this.cell.inLink) {
                this.targets.push(this.cell.storage);
                this.suckerTargets.push(this.cell.link);
            }
            else if (this.cell.inLink > this.cell.link.store.getUsedCapacity(RESOURCE_ENERGY))
                this.targets.push(this.cell.link);
        }
        // 5 for random shit
        // tragets.length cause dont need a manager for nothing
        if (Game.time + 5 >= this.lastSpawned + CREEP_LIFE_TIME && this.targets.length > 0) {
            let order = {
                master: this.ref,
                setup: Setups.manager.normal,
                amount: 1,
            };
            this.lastSpawned = Game.time;
            this.hive.wish(order);
        }
    }
    ;
    run() {
        // TODO smarter choosing of target
        _.forEach(this.managers, (bee) => {
            let target;
            let ans;
            if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                target = _.filter(this.targets, (structure) => structure.structureType == STRUCTURE_TOWER &&
                    structure.store.getCapacity(RESOURCE_ENERGY) * 0.75 >= structure.store.getUsedCapacity(RESOURCE_ENERGY))[0];
                if (!target)
                    target = _.filter(this.targets, (structure) => structure.structureType == STRUCTURE_LINK &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)[0];
                console.log(this.targets);
                if (!target)
                    target = _.filter(this.targets, (structure) => structure.structureType == STRUCTURE_TOWER &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)[0];
                if (!target)
                    target = _.filter(this.targets, (structure) => structure.structureType == STRUCTURE_STORAGE &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)[0];
                if (target)
                    if (target instanceof StructureLink)
                        ans = bee.transfer(target, RESOURCE_ENERGY, Math.min(bee.creep.store.getUsedCapacity(RESOURCE_ENERGY), this.cell.inLink - target.store.getUsedCapacity(RESOURCE_ENERGY)));
                    else
                        ans = bee.transfer(target, RESOURCE_ENERGY);
            }
            if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0 || !target || ans == OK) {
                let suckerTarget;
                if (!suckerTarget)
                    suckerTarget = _.filter(this.suckerTargets, (structure) => structure.structureType == STRUCTURE_LINK &&
                        structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0)[0];
                if (!suckerTarget)
                    suckerTarget = _.filter(this.suckerTargets, (structure) => structure.structureType == STRUCTURE_STORAGE &&
                        structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0)[0];
                if (suckerTarget) {
                    if (suckerTarget instanceof StructureLink)
                        bee.withdraw(suckerTarget, RESOURCE_ENERGY, Math.min(bee.creep.store.getFreeCapacity(RESOURCE_ENERGY), suckerTarget.store.getUsedCapacity(RESOURCE_ENERGY) - this.cell.inLink));
                    else
                        bee.withdraw(suckerTarget, RESOURCE_ENERGY);
                }
            }
        });
    }
    ;
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
            this.inLink = link.store.getCapacity(RESOURCE_ENERGY) * 0.5;
        }
    }
    update() {
        super.update();
        if (!this.beeMaster)
            this.beeMaster = new managerMaster(this);
    }
    run() {
        if (this.link && Object.keys(this.linkRequests).length) {
            let key = Object.keys(this.linkRequests)[0];
            let order = this.linkRequests[key];
            if (!this.link.cooldown && (!order.amount || this.link.store.getUsedCapacity(RESOURCE_ENERGY) >= order.amount
                || order.amount >= this.inLink)) {
                this.link.transferEnergy(order.link, order.amount);
                delete this.linkRequests[key];
            }
        }
    }
}

class upgraderMaster extends Master {
    constructor(upgradeCell) {
        super(upgradeCell.hive, "master_" + upgradeCell.ref);
        this.upgraders = [];
        this.targetBeeCount = 2;
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
        if (this.upgraders.length < this.targetBeeCount && !this.waitingForABee) {
            let order = {
                master: this.ref,
                setup: Setups.upgrader,
                amount: this.targetBeeCount - this.upgraders.length,
            };
            this.waitingForABee += this.targetBeeCount - this.upgraders.length;
            this.hive.wish(order);
        }
    }
    ;
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
    ;
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
            this.hive.cells.storageCell && !this.hive.cells.storageCell.linkRequests[this.ref]) {
            this.hive.cells.storageCell.linkRequests[this.ref] = {
                link: this.link
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
    }
    ;
    // second stage of decision making like where do i need to spawn creeps or do i need
    run() {
        // #TODO better target picking
        if (this.hive.roomTargets.length) {
            _.forEach(this.towers, (tower) => {
                let closest = tower.pos.findClosestByRange(this.hive.roomTargets);
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
        this.refreshLastSpawned();
    }
    newBee(bee) {
        this.queens.push(bee);
        this.refreshLastSpawned();
    }
    refreshLastSpawned() {
        _.forEach(this.queens, (bee) => {
            if (bee.creep.ticksToLive && Game.time - bee.creep.ticksToLive >= this.lastSpawned)
                this.lastSpawned = Game.time - bee.creep.ticksToLive;
        });
    }
    update() {
        this.queens = this.clearBees(this.queens);
        // 5 for random shit
        if (Game.time + 5 >= this.lastSpawned + CREEP_LIFE_TIME) {
            let order = {
                master: this.ref,
                setup: Setups.manager.normal,
                amount: 1,
            };
            this.lastSpawned = Game.time;
            this.hive.wish(order);
        }
    }
    ;
    run() {
        let targets = this.cell.spawns;
        targets = _.filter(targets.concat(this.cell.extensions), (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
        _.forEach(this.queens, (bee) => {
            let target;
            if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                target = bee.creep.pos.findClosest(targets);
                if (target)
                    bee.transfer(target, RESOURCE_ENERGY);
            }
            if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0 || !target) {
                let suckerTarget;
                if (!suckerTarget && this.hive.cells.storageCell)
                    suckerTarget = this.hive.cells.storageCell.storage;
                if (suckerTarget)
                    bee.withdraw(suckerTarget, RESOURCE_ENERGY);
            }
        });
    }
    ;
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
        if (!this.beeMaster)
            this.beeMaster = new queenMaster(this);
    }
    ;
    // second stage of decision making like where do i need to spawn creeps or do i need
    run() {
        // generate the queue and start spawning
        let remove = [];
        _.some(this.hive.orderList, (order, key) => {
            if (!this.freeSpawns.length)
                return true;
            if (order.amount <= 0 || !global.masters[order.master]) {
                remove.push(this.hive.orderList[key]);
            }
            else {
                let body = order.setup.getBody(this.hive.room.energyAvailable);
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
                    order.amount -= 1;
                }
            }
            return false;
        });
        _.forEach(remove.reverse(), (key) => {
            this.hive.orderList.splice(key, 1);
        });
    }
    ;
}

// import { bootstrapMaster } from "../beeMaster/bootstrap";
class developmentCell extends Cell {
    constructor(hive, controller) {
        super(hive, "developmentCell_" + hive.room.name);
        this.controller = controller;
        let link = _.filter(this.controller.pos.findInRange(FIND_MY_STRUCTURES, 2), (structure) => structure.structureType == STRUCTURE_LINK);
        if (link instanceof StructureLink) {
            this.link = link;
        }
    }
    update() {
        super.update();
        //if (!this.master)
        // this.master = new bootstrapMaster(this);
    }
    run() { }
}

class builderMaster extends Master {
    constructor(hive) {
        super(hive, "master_" + "builderHive_" + hive.room.name);
        this.builders = [];
        this.targetBeeCount = 1;
        this.waitingForABee = 0;
    }
    newBee(bee) {
        this.builders.push(bee);
        if (!this.waitingForABee)
            this.waitingForABee -= 1;
    }
    update() {
        this.builders = this.clearBees(this.builders);
        if ((this.hive.emergencyRepairs.length || this.hive.constructionSites.length) && this.builders.length < this.targetBeeCount && !this.waitingForABee) {
            let order = {
                master: this.ref,
                setup: Setups.builder,
                amount: this.targetBeeCount - this.builders.length,
            };
            this.waitingForABee += this.targetBeeCount - this.builders.length;
            this.hive.wish(order);
        }
    }
    ;
    run() {
        _.forEach(this.builders, (bee) => {
            // TODO: getting energy if no targets?
            let ans = ERR_FULL;
            if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
                let suckerTarget;
                if (!suckerTarget && this.hive.cells.storageCell)
                    suckerTarget = this.hive.cells.storageCell.storage;
                if (suckerTarget)
                    ans = bee.withdraw(suckerTarget, RESOURCE_ENERGY);
                else
                    ans = OK;
            }
            if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 || ans == OK) {
                let target = bee.creep.pos.findClosest(this.hive.emergencyRepairs);
                if (!target)
                    target = bee.creep.pos.findClosest(this.hive.constructionSites);
                if (!target)
                    target = bee.creep.pos.findClosest(this.hive.normalRepairs);
                if (target) {
                    if (target instanceof ConstructionSite)
                        bee.build(target);
                    else if (target instanceof Structure)
                        bee.repair(target);
                }
            }
        });
    }
    ;
}

var _a, _b;
class repairSheet {
    constructor() {
        this[_a] = 200000;
        this[_b] = 200000;
        this.other = 1;
        this.collapse = 0.5;
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
        this.orderList = [];
        //targets for defense systems
        this.roomTargets = [];
        this.annexTargets = [];
        // some structures (aka preprocess of filters)
        this.constructionSites = [];
        this.emergencyRepairs = [];
        this.normalRepairs = [];
        this.room = Game.rooms[roomName];
        this.annexes = _.compact(_.map(annexNames, (annexName) => Game.rooms[annexName]));
        this.rooms = [this.room].concat(this.annexes);
        this.repairSheet = new repairSheet();
        this.cells = {};
        this.parseStructures();
        this.builder = new builderMaster(this);
    }
    parseStructures() {
        this.updateConstructionSites();
        this.updateEmeregcyRepairs();
        this.updateNormalRepairs();
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
        if (storage) {
            this.cells.storageCell = new storageCell(this, storage);
            this.cells.upgradeCell = new upgradeCell(this, this.room.controller);
            let allSources = [];
            _.forEach(this.rooms, (room) => {
                let sources = room.find(FIND_SOURCES);
                allSources = allSources.concat(sources);
            });
            if (allSources.length) {
                this.cells.excavationCell = new excavationCell(this, allSources);
            }
            this.cells.respawnCell = new respawnCell(this, spawns, extensions);
        }
        else {
            this.cells.developmentCell = new developmentCell(this, this.room.controller);
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
        this.roomTargets = _.filter(this.room.find(FIND_HOSTILE_CREEPS), (creep) => creep.getBodyparts(ATTACK) || creep.getBodyparts(HEAL));
        this.annexTargets = [];
        _.forEach(this.annexes, (room) => {
            this.annexTargets = this.annexTargets.concat(_.filter(room.find(FIND_HOSTILE_CREEPS), (creep) => creep.getBodyparts(ATTACK) || creep.getBodyparts(HEAL)));
        });
    }
    // add to list a new creep
    wish(order) {
        // add some checks
        this.orderList.push(order);
    }
    updateRooms() {
        this.room = Game.rooms[this.room.name];
        this.annexes = _.compact(_.map(this.annexes, (annex) => Game.rooms[annex.name]));
        this.rooms = [this.room].concat(this.annexes);
    }
    update() {
        if (Game.time % 5 == 0) {
            this.updateConstructionSites();
            this.updateEmeregcyRepairs();
            this.updateNormalRepairs();
        }
        else if (Game.time % 5 == 1) {
            this.findTargets();
        }
        else if (Game.time % 5 == 2) {
            this.updateRooms();
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
    // time to inherite some shit from Creep
    // for now it will be forever binded
    constructor(creep) {
        this.creep = creep;
        this.master = global.masters[this.creep.memory.refMaster];
        this.ref = creep.name;
        // not sure weather i should copy all parameters from creep like body and stuff
        global.bees[this.creep.name] = this;
    }
    print(info) {
        console.log(Game.time, "!", this.creep.name, "?", info);
    }
    harvest(source) {
        if (this.creep.pos.isNearTo(source))
            this.creep.harvest(source);
        else
            this.goTo(source);
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
    reserveController(target) {
        if (this.creep.pos.isNearTo(target))
            return this.creep.reserveController(target);
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
    goTo(target) {
        this.creep.moveTo(target, {
            reusePath: 1,
        });
    }
}

// This gets run on each global reset
function onGlobalReset() {
    // check if all memory position were created
    Mem.init();
    global.hives = {};
    global.bees = {};
    global.masters = {};
    /*
      _.forEach(Object.keys(Memory.masters), (ref) => {
        // recreate all the masters if failed => delete the master
        if (!global.masters[ref])
          delete Memory.masters[ref];
      });
    */
    let roomName = "sim";
    global.hives[roomName] = new Hive(roomName, []);
    console.log("Reset? Cool time is", Game.time);
}
function main() {
    if (!global.hives) {
        onGlobalReset();
    }
    // update phase
    _.forEach(global.hives, (hive) => {
        hive.update();
    });
    // after all the masters where created and retrived if it was needed
    for (const creepName in Memory.creeps) {
        let creep = Game.creeps[creepName];
        if (creep)
            if (!global.bees[creepName]) {
                if (global.masters[creep.memory.refMaster]) {
                    // not sure if i rly need a global bees hash
                    global.bees[creep.name] = new Bee(creep);
                    global.masters[creep.memory.refMaster].newBee(global.bees[creep.name]);
                }
                // idk what to do if i lost a master to the bee. I guess the bee is just FUCKED for now
            }
            else {
                // i guess it is not gonna be fixed :/
                global.bees[creepName].creep = creep;
            }
        else if (global.bees[creepName])
            delete global.bees[creepName];
    }
    _.forEach(global.masters, (master) => {
        master.update();
    });
    // run phase
    _.forEach(global.hives, (hive) => {
        hive.run();
    });
    _.forEach(global.masters, (master) => {
        master.run();
    });
    // Automatically delete memory
    Mem.clean();
}
let _loop = main;
{
    _loop = ErrorMapper.wrapLoop(main);
}
const loop = _loop;
onGlobalReset();

exports.loop = loop;
//# sourceMappingURL=main.js.map
