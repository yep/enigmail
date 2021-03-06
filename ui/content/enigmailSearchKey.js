/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick@mozilla-enigmail.org> are
 * Copyright (C) 2004 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */

// Uses: chrome://enigmail/content/enigmailCommon.js

Components.utils.import("resource://enigmail/enigmailCommon.jsm");
const Ec = EnigmailCommon;

const INPUT = 0;
const RESULT = 1;

const ENIG_DEFAULT_HKP_PORT  = "11371";
const ENIG_DEFAULT_LDAP_PORT = "389";

const ENIG_IMG_NOT_SELECTED = "chrome://enigmail/content/check0.png";
const ENIG_IMG_SELECTED     = "chrome://enigmail/content/check1.png";
const ENIG_IMG_DISABLED     = "chrome://enigmail/content/check2.png";

const ENIG_CONN_TYPE_HTTP    = 1;
const ENIG_CONN_TYPE_GPGKEYS = 2;

const KEY_EXPIRED="e";
const KEY_REVOKED="r";
const KEY_INVALID="i";
const KEY_DISABLED="d";
const KEY_NOT_VALID=KEY_EXPIRED+KEY_REVOKED+KEY_INVALID+KEY_DISABLED;

var gErrorData = "";
var gOutputData = "";
var gEnigRequest;

function trim(str) {
  return str.replace(/^(\s*)(.*)/, "$2").replace(/\s+$/,"");
}

function onLoad () {

  window.arguments[RESULT].importedKeys=0;

  var keyserver = window.arguments[INPUT].keyserver;
  var protocol="";
  if (keyserver.search(/[a-zA-Z0-9\-\_\.]+:\/\//)==0) {
    protocol=keyserver.replace(/^([a-zA-Z0-9\-\_\.]+)(:\/\/.*)/, "$1");
    if (protocol.search(/hkp/i) >= 0) {
      protocol="hkp";
    }
    keyserver=keyserver.replace(/^[a-zA-Z0-9\-\_\.]+:\/\//, "");
  }
  else {
    protocol="hkp";
  }

  var port="";
  switch (protocol) {
  case "hkp":
    port = ENIG_DEFAULT_HKP_PORT;
    break;
  case "ldap":
    port = ENIG_DEFAULT_LDAP_PORT;
    break;
  }

  var m = keyserver.match(/^(.+)(:)(\d+)$/);
  if (m && m.length==4) {
    keyserver = m[1];
    port = m[3];
  }

  gEnigRequest = {
    searchList: window.arguments[INPUT].searchList,
    keyNum: 0,
    keyserver: keyserver,
    port: port,
    protocol: protocol,
    keyList: [],
    requestType: (Ec.getPref("useGpgKeysTool") ? ENIG_CONN_TYPE_GPGKEYS : ENIG_CONN_TYPE_HTTP),
    gpgkeysRequest: null,
    progressMeter: document.getElementById("dialog.progress"),
    httpInProgress: false
  };

  gEnigRequest.progressMeter.mode="undetermined";

  if (window.arguments[INPUT].searchList.length == 1 &&
      window.arguments[INPUT].searchList[0].search(/^0x[A-Fa-f0-9]{8,16}$/) == 0) {
      // shrink dialog and start download if just one key ID provided

      gEnigRequest.dlKeyList = window.arguments[INPUT].searchList;
      document.getElementById("keySelGroup").setAttribute("collapsed", "true");
      window.sizeToContent();
      window.resizeBy(0, -320);
      Ec.dispatchEvent(startDownload, 10);
  }
  else {
    switch (gEnigRequest.requestType) {
    case ENIG_CONN_TYPE_HTTP:
      enigNewHttpRequest(nsIEnigmail.SEARCH_KEY, enigScanKeys);
      break;
    case ENIG_CONN_TYPE_GPGKEYS:
      enigNewGpgKeysRequest(nsIEnigmail.SEARCH_KEY, enigScanKeys);
      break;
    }
  }
  return true;
}


function onAccept () {
  Ec.DEBUG_LOG("enigmailSearchKey.js: onAccept\n");

  var keySelList = document.getElementById("enigmailKeySel");
  var treeChildren=keySelList.getElementsByAttribute("id", "enigmailKeySelChildren")[0];

  gEnigRequest.dlKeyList = [];
  var item=treeChildren.firstChild;
  while (item) {
    var aRows = item.getElementsByAttribute("id","indicator")
    if (aRows.length) {
      var elem=aRows[0];
      if (elem.getAttribute("active") == "1") {
        gEnigRequest.dlKeyList.push(item.getAttribute("id"));
      }
    }
    item = item.nextSibling;
  }
  return startDownload();
}


function startDownload() {
  Ec.DEBUG_LOG("enigmailSearchKey.js: startDownload\n");
  if (gEnigRequest.dlKeyList.length>0) {
    gEnigRequest.progressMeter.value = 0;
    gEnigRequest.progressMeter.mode = "undetermined";
    document.getElementById("progress.box").removeAttribute("hidden");
    document.getElementById("dialog.accept").setAttribute("disabled", "true");
    gEnigRequest.keyNum = 0;
    gEnigRequest.errorTxt="";
    switch (gEnigRequest.requestType) {
    case ENIG_CONN_TYPE_HTTP:
      enigNewHttpRequest(nsIEnigmail.DOWNLOAD_KEY, enigImportKeys);
      break;
    case ENIG_CONN_TYPE_GPGKEYS:
      enigNewGpgKeysRequest(nsIEnigmail.DOWNLOAD_KEY, enigImportKeys);
      break;
    }

    // do not yet close the window, so that we can display some progress info
    return false;
  }

  return true;
}


function onCancel() {
  Ec.DEBUG_LOG("enigmailSearchKey.js: onCancel\n");

  if (gEnigRequest.httpInProgress) {
    // stop download
    try {
      if ((typeof(window.enigHttpReq) == "object") &&
          (window.enigHttpReq.readyState != 4)) {
          window.enigHttpReq.abort();
      }
      gEnigRequest.httpInProgress=false;
    }
    catch (ex) {}
  }

  if (gEnigRequest.gpgkeysRequest) {

    var p = gEnigRequest.gpgkeysRequest;
    gEnigRequest.gpgkeysRequest = null;
    p.kill(false);
  }

  gOutputData = "";
  window.close();
}


function enigStatusError () {
  Ec.DEBUG_LOG("enigmailSearchKey.js: enigStatusError\n");
  gEnigRequest.httpInProgress=false;
  Ec.alert(window, Ec.getString("noKeyserverConn", this.channel.originalURI.prePath));
  enigCloseDialog();
}

function enigCloseDialog() {
  document.getElementById("enigmailSearchKeyDlg").cancelDialog();
  window.close();
}

function enigStatusLoaded (event) {
  Ec.DEBUG_LOG("enigmailSearchKey.js: enigStatusLoaded\n");

  if (this.status == 200) {
    // de-HTMLize the result
    var htmlTxt = this.responseText.replace(/<([^<>]+)>/g, "");

    this.requestCallbackFunc(ENIG_CONN_TYPE_HTTP, htmlTxt);
  }
  else if (this.status == 500 && this.statusText=="OK") {
    this.requestCallbackFunc(ENIG_CONN_TYPE_HTTP, "no keys found");
  }
  else if (this.statusText!="OK") {
    Ec.alert(window, Ec.getString("keyDownloadFailed", this.statusText));
    enigCloseDialog();
    return;
  }

}


function enigImportKeys (connType, txt, errorTxt) {
  Ec.DEBUG_LOG("enigmailSearchKey.js: enigImportKeys\n");

  gEnigRequest.keyNum++;
  gEnigRequest.progressMeter.mode = "determined";
  gEnigRequest.progressMeter.value = (100 * gEnigRequest.keyNum / gEnigRequest.dlKeyList.length).toFixed(0);

  if (txt.search(/^\[GNUPG:\] IMPORT_RES/m) < 0) {
    if (!enigImportHtmlKeys(txt)) return;
  }
  else if (errorTxt) {
    gEnigRequest.errorTxt +=errorTxt+"\n";
  }

  if (txt.search(/^\[GNUPG:\] IMPORT_RES/m) >= 0) {
    window.arguments[RESULT].importedKeys++;
  }

  if (gEnigRequest.dlKeyList.length > gEnigRequest.keyNum) {
    switch (connType) {
      case ENIG_CONN_TYPE_HTTP:
        enigNewHttpRequest(nsIEnigmail.DOWNLOAD_KEY, window.enigHttpReq.requestCallbackFunc);
        break;
      case ENIG_CONN_TYPE_GPGKEYS:
        enigNewGpgKeysRequest(nsIEnigmail.DOWNLOAD_KEY, gEnigRequest.callbackFunction);
    }
    return;
  }
  else if (gEnigRequest.errorTxt) {
    Ec.longAlert(window, Ec.convertGpgToUnicode(gEnigRequest.errorTxt));
  }

  gEnigRequest.httpInProgress=false;

  enigCloseDialog();
}

function enigImportHtmlKeys(txt) {
  var errorMsgObj = new Object();

  var enigmailSvc = GetEnigmailSvc();
  if (! enigmailSvc)
    return false;

  var uiFlags = nsIEnigmail.UI_ALLOW_KEY_IMPORT;
  var r = enigmailSvc.importKey(window, uiFlags, txt,
                        gEnigRequest.dlKeyList[gEnigRequest.keyNum-1],
                        errorMsgObj);
  if (errorMsgObj.value)
    Ec.alert(window, errorMsgObj.value);
  if (r == 0) {
    window.arguments[RESULT].importedKeys++;
    return true;
  }
  return false;
}


function enigNewHttpRequest(requestType, requestCallbackFunc) {
  Ec.DEBUG_LOG("enigmailSearchKey.js: enigNewHttpRequest\n");

  switch (gEnigRequest.protocol) {
  case "hkp":
    gEnigRequest.protocol = "http";
  case "http":
  case "https":
    break;
  default:
    var msg=Ec.getString("protocolNotSupported", gEnigRequest.protocol);
    if (! Ec.getPref("useGpgKeysTool"))
      msg += " "+Ec.getString("gpgkeysDisabled");
    Ec.alert(window, msg);
    enigCloseDialog();
    return;
  }

  var httpReq = new XMLHttpRequest();
  var reqCommand;
  switch (requestType) {
  case nsIEnigmail.SEARCH_KEY:
    var pubKey = escape("<"+trim(gEnigRequest.searchList[gEnigRequest.keyNum])+">");
    reqCommand = gEnigRequest.protocol+"://"+gEnigRequest.keyserver+":"+gEnigRequest.port+"/pks/lookup?search="+pubKey+"&op=index";
    break;
  case nsIEnigmail.DOWNLOAD_KEY:
    var keyId = escape(trim(gEnigRequest.dlKeyList[gEnigRequest.keyNum]));
    reqCommand = gEnigRequest.protocol+"://"+gEnigRequest.keyserver+":"+gEnigRequest.port+"/pks/lookup?search="+keyId+"&op=get";
    break;
  default:
    Ec.alert(window, "Unknown request type "+requestType);
    return;
  }

  gEnigRequest.httpInProgress=true;
  httpReq.open("GET", reqCommand);
  httpReq.onerror=enigStatusError;
  httpReq.onload=enigStatusLoaded;
  httpReq.requestCallbackFunc = requestCallbackFunc;
  window.enigHttpReq = httpReq;
  httpReq.send("");
}


function enigScanKeys(connType, htmlTxt) {
  Ec.DEBUG_LOG("enigmailSearchKey.js: enigScanKeys\n");

  gEnigRequest.keyNum++;
  gEnigRequest.progressMeter.mode = "determined";
  gEnigRequest.progressMeter.value = (100 * gEnigRequest.keyNum / gEnigRequest.searchList.length).toFixed(0);

  switch (connType) {
    case ENIG_CONN_TYPE_HTTP:
      // interpret HTML codes (e.g. &lt;)
      var domParser = new DOMParser();
      // needs improvement: result is max. 4096 bytes long!
      var htmlNode = domParser.parseFromString("<p>" + htmlTxt + "</p>", "text/xml");

      if (htmlNode.firstChild.nodeName=="parsererror") {
        Ec.alert(window, "internalError");
        return false;
      }
      enigScanHtmlKeys(htmlNode.firstChild.firstChild.data);
      break;
    case ENIG_CONN_TYPE_GPGKEYS:
      enigScanGpgKeys(Ec.convertGpgToUnicode(unescape(htmlTxt)));
      break;
    default:
      Ec.ERROR_LOG("Unkonwn connType: "+connType+"\n");
  }

  if (gEnigRequest.searchList.length > gEnigRequest.keyNum) {
    switch (connType) {
      case ENIG_CONN_TYPE_HTTP:
        enigNewHttpRequest(nsIEnigmail.SEARCH_KEY, window.enigHttpReq.requestCallbackFunc);
        break;
      case  ENIG_CONN_TYPE_GPGKEYS:
        enigNewGpgKeysRequest(nsIEnigmail.SEARCH_KEY, gEnigRequest.callbackFunction);
    }
    return true;
  }

  gEnigRequest.httpInProgress=false;
  enigPopulateList(gEnigRequest.keyList);
  document.getElementById("progress.box").setAttribute("hidden", "true");
  if (gEnigRequest.keyList.length == 0) {
    Ec.alert(window, Ec.getString("noKeyFound"));
    enigCloseDialog();
  }

  document.getElementById("dialog.accept").removeAttribute("disabled");

  return true;
}

function enigScanHtmlKeys (txt) {
  Ec.DEBUG_LOG("enigmailSearchKey.js: enigScanHtmlKeys\n");

  var lines=txt.split(/(\n\r|\n|\r)/);
  var key;
  for (i=0; i<lines.length; i++) {
    if (lines[i].search(/^\s*pub /)==0) {
      // new key
      if (key) {
        // first, append prev. key to keylist
        gEnigRequest.keyList.push(key);
      }
      key = null;
      var m=lines[i].match(/(\d+[a-zA-Z]?\/)([0-9a-fA-F]+)(\s+[\d\/\-\.]+\s+)(.*)/);
      if (m && m.length>0 ) {
        key={
          keyId: m[2],
          created: m[3],
          uid: []
        };
        if (m[4].search(/.+<.+@.+>/)>=0) {
          if (! ignoreUid(m[4])) key.uid.push(trim(m[4]));
        }
        else if (m[4].search(/key (revoked|expired|disabled)/i)>=0) {
          Ec.DEBUG_LOG("revoked key id "+m[4]+"\n");
          key=null;
        }
      }
    }
    else {
      // amend to key
      if (key) {
        var uid = trim(lines[i]);
        if (uid.length>0 && ! ignoreUid(uid))
          key.uid.push(uid);
      }
    }
  }

  // append prev. key to keylist
  if (key) {
    gEnigRequest.keyList.push(key);
  }
}


function enigScanGpgKeys(txt) {
  Ec.DEBUG_LOG("enigmailSearchKey.js: enigScanGpgKeys\n");
  Ec.DEBUG_LOG("got text: "+txt+"\n");

  var lines=txt.split(/(\r\n|\n|\r)/);
  var outputType=0;
  var key;
  for (var i=0; i<lines.length; i++) {
    if (outputType == 0 && lines[i].search(/^COUNT \d+\s*$/)==0) {
      outputType=1;
      continue;
    }
    if (outputType == 0 && lines[i].search(/^pub:[\da-fA-F]{8}/)==0) {
      outputType=2;
    }
    if (outputType==1 && (lines[i].search(/^([a-fA-F0-9]{8}){1,2}:/))==0) {
      // output from gpgkeys_* protocol version 0
      // new key
      var m=lines[i].split(/:/);
      if (m && m.length>0 ) {
        if (key) {
          if (key.keyId == m[0]) {
            if (! ignoreUid(m[i])) key.uid.push(trim(m[1]));
          }
          else {
            gEnigRequest.keyList.push(key);
            key=null;
          }
        }
        if (! key) {
          var dat=new Date(m[3]*1000);
          var month=String(dat.getMonth()+101).substr(1);
          var day=String(dat.getDate()+100).substr(1);
          key={
            keyId: m[0],
            created: dat.getFullYear()+"-"+month+"-"+day,
            uid: []
          };
          if (! ignoreUid(m[1])) key.uid.push(m[1]);
        }
      }
    }
    if (outputType==2 && (lines[i].search(/^pub:/))==0) {
      // output from gpgkeys_* protocol version 1
      // new key
      m=lines[i].split(/:/);
      if (m && m.length>1 ) {
        if (key) {
          gEnigRequest.keyList.push(key);
          key=null;
        }
        dat=new Date(m[4]*1000);
        month=String(dat.getMonth()+101).substr(1);
        day=String(dat.getDate()+100).substr(1);
        key={
          keyId: m[1],
          created: dat.getFullYear()+"-"+month+"-"+day,
          uid: []
        };
      }
    }
    if (outputType==2 && (lines[i].search(/^uid:.+/))==0) {
      // output from gpgkeys_* protocol version 1
      // uid for key
      m=lines[i].split(/:/);
      if (m && m.length>1 ) {
        if (key && ! ignoreUid(m[1])) key.uid.push(trim(m[1]));
      }
    }
  }

  // append prev. key to keylist
  if (key) {
    gEnigRequest.keyList.push(key);
  }
}

// interaction with gpgkeys_xxx

function enigNewGpgKeysRequest(requestType, callbackFunction) {
  Ec.DEBUG_LOG("enigmailSearchkey.js: enigNewGpgKeysRequest\n");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
    Ec.alert(window, Ec.getString("accessError"));
    return;
  }

  gEnigRequest.callbackFunction = callbackFunction;
  gEnigRequest.gpgkeysRequest = null;

  gErrorData = "";
  gOutputData = "";

  var procListener = {
    onStopRequest: function (exitCode) {
      enigmailGpgkeysTerminate(exitCode);
    },
    onStdoutData: function(data) {
      gOutputData += data;
    },
    onErrorData: function(data) {
      gErrorData += data;
    }
  }

  if (requestType == nsIEnigmail.SEARCH_KEY) {
    var keyValue = gEnigRequest.searchList[gEnigRequest.keyNum];
  }
  else {
    keyValue = gEnigRequest.dlKeyList[gEnigRequest.keyNum];
  }


  var errorMsgObj = {};
  gEnigRequest.gpgkeysRequest = Ec.searchKey(requestType,
                                 gEnigRequest.protocol,
                                 gEnigRequest.keyserver,
                                 gEnigRequest.port,
                                 keyValue,
                                 procListener,
                                 errorMsgObj);

  if (!gEnigRequest.gpgkeysRequest) {
    // calling gpgkeys_xxx failed, let's try builtin http variant
    switch (gEnigRequest.protocol) {
    case "hkp":
    case "http":
    case "https":
      gEnigRequest.requestType = ENIG_CONN_TYPE_HTTP;
      enigNewHttpRequest(requestType, enigScanKeys);
      return;
    default:
      Ec.alert(window, Ec.getString("gpgKeysFailed", gEnigRequest.protocol));
      enigCloseDialog();
      return;
    }
  }

  Ec.DEBUG_LOG("enigmailSearchkey.js: Start: gEnigRequest.gpgkeysRequest = "+gEnigRequest.gpgkeysRequest+"\n");
}


function enigmailGpgkeysTerminate(exitCode) {
  Ec.DEBUG_LOG("enigmailSearchkey.js: Terminate: exitCode="+exitCode+"\n");

  gEnigRequest.gpgkeysRequest = null;

  try {
    if (gErrorData.length > 0) {
      Ec.DEBUG_LOG("enigmailSearchkey.js: Terminate(): stderr has data:\n");
      CONSOLE_LOG(gErrorData+"\n");
    }

    exitCode = Ec.fixExitCode(exitCode, 0);

    if (gOutputData.length > 0) {
      gEnigRequest.callbackFunction(ENIG_CONN_TYPE_GPGKEYS, gOutputData, gErrorData);
    }

  } catch (ex) {}
}

// GUI related stuff

function enigPopulateList(keyList) {
  Ec.DEBUG_LOG("enigmailSearchKey.js: enigPopulateList\n");

  var sortUsers = function (a,b) {
     if (a.uid[0]<b.uid[0]) { return -1; } else {return 1; }
  }

  keyList.sort(sortUsers);

  var treeList = document.getElementById("enigmailKeySel");
  var treeChildren=treeList.getElementsByAttribute("id", "enigmailKeySelChildren")[0];
  var treeItem;

  for (var i=0; i<keyList.length; i++) {
    treeItem = enigUserSelCreateRow(keyList[i].keyId, false, keyList[i].uid[0], keyList[i].created, "");
    if (keyList[i].uid.length>1) {
      treeItem.setAttribute("container", "true");
      var subChildren=document.createElement("treechildren");
      for (j=1; j<keyList[i].uid.length; j++) {
        var subItem=enigUserSelCreateRow(keyList[i].keyId, true, keyList[i].uid[j], "", "");
        subChildren.appendChild(subItem);
      }
      treeItem.appendChild(subChildren);
    }
    treeChildren.appendChild(treeItem);
  }

  if (keyList.length == 1) {
    // activate found item if just one key found
    enigSetActive(treeItem.firstChild.firstChild, 1);
  }
}

function enigUserSelCreateRow (keyId, subKey, userId, dateField, trustStatus) {
    var selectCol=document.createElement("treecell");
    selectCol.setAttribute("id", "indicator");
    var expCol=document.createElement("treecell");
    var userCol=document.createElement("treecell");
    userCol.setAttribute("id", "name");
    if (trustStatus.charAt(0)==KEY_EXPIRED) {
      expCol.setAttribute("label", Ec.getString("selKeyExpired", dateField));
    }
    else {
      expCol.setAttribute("label", dateField);
    }

    expCol.setAttribute("id", "expiry");
    userCol.setAttribute("label", userId);
    var keyCol=document.createElement("treecell");
    keyCol.setAttribute("id", "keyid");
    if (subKey) {
      enigSetActive(selectCol, -1);
      keyCol.setAttribute("label", "");
    }
    else  {
      enigSetActive(selectCol, 0);
      keyCol.setAttribute("label", keyId.substr(-8));
    }


    var userRow=document.createElement("treerow");
    userRow.appendChild(selectCol);
    userRow.appendChild(userCol);
    userRow.appendChild(expCol);
    userRow.appendChild(keyCol);
    var treeItem=document.createElement("treeitem");
    treeItem.setAttribute("id", "0x"+keyId);
    treeItem.appendChild(userRow);
    return treeItem;
}

function enigmailKeySelCallback(event) {
  Ec.DEBUG_LOG("enigmailSearchKey.js: enigmailKeySelCallback\n");

  var Tree = document.getElementById("enigmailKeySel");
  var row = {};
  var col = {};
  var elt = {};
  Tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, elt);
  if (row.value == -1)
    return;


  var treeItem = Tree.contentView.getItemAtIndex(row.value);
  Tree.currentItem=treeItem;
  if (col.value.id != "selectionCol")
    return;

  var aRows = treeItem.getElementsByAttribute("id","indicator")

  if (aRows.length) {
    var elem=aRows[0];
    if (elem.getAttribute("active") == "1") {
      enigSetActive(elem, 0);
    } else if (elem.getAttribute("active") == "0") {
      enigSetActive(elem, 1);
    }
  }
}

// set the "active" flag and the corresponding image
function enigSetActive(element, status) {

  if (status>=0)
    element.setAttribute("active", status.toString());

  switch (status)
  {
  case 0:
    element.setAttribute("src", ENIG_IMG_NOT_SELECTED);
    break;
  case 1:
    element.setAttribute("src", ENIG_IMG_SELECTED);
    break;
  case 2:
    element.setAttribute("src", ENIG_IMG_DISABLED);
    break;
  default:
    element.setAttribute("active", -1);
  }
}

function ignoreUid(uid) {
  const ignoreList = "{Test 555 <sdfg@gga.com>}";
  return (ignoreList.indexOf("{"+trim(uid)+"}") >= 0);
}
