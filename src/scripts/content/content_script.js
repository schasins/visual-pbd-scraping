/**********************************************************************
 * Author: S. Chasins
 **********************************************************************/

/**********************************************************************
 * Listeners and general set up
 **********************************************************************/
 var tabID = "setme";

//user event handling
document.addEventListener('mouseover', outline, true);
document.addEventListener('mouseout', unoutline, true);
document.addEventListener('click', scrapingClick, true);
document.addEventListener('keydown', checkScrapingOn, true);
document.addEventListener('keyup', checkScrapingOff, true);

//for debugging purposes, print this tab's tab id
utilities.listenForMessage("background", "content", "tabID", function(msg){tabID = msg; console.log("tab id: ", msg);});
utilities.sendMessage("content", "background", "requestTabID", {});

function currentlyRecording(){
  return recording == RecordState.RECORDING; // recording variable is defined in scripts/lib/record-replay/content_script.js
}

/**********************************************************************
 * Color guide to show users the node they're about to select
 **********************************************************************/

function targetFromEvent(event){
  var $target = $(event.target);
  return $target.get(0);
}

var highlightColor = "#E04343";
var tooltipColor = "#DBDBDB";
var tooltipBorderColor = "#B0B0B0";

function outline(event){
  node, $node = null;
  if (currentlyRecording()){
    var node = targetFromEvent(event);
    var $node = $(node);
    scrapingTooltip(node);
  }
  if (currentlyScraping()){
    outlineTarget(targetFromEvent(event));
  }
}

var outlinedNodes = [];
function outlineTarget(target){
  $target = $(target);
  $target.data("stored_background_color", window.getComputedStyle(target, null).getPropertyValue('background-color'));
  $target.data("stored_outline", window.getComputedStyle(target, null).getPropertyValue('outline'));
  outlinedNodes.push(target);
  $target.css('background-color', highlightColor);
  $target.css('outline', highlightColor+' 1px solid');
}

function scrapingTooltip(node){
  var $node = $(node);
  var nodeText = "CTRL + ALT + click to scrape:<br>"+nodeToText(node);

  var offset = $node.offset();
  var boundingBox = node.getBoundingClientRect();
  var newDiv = $('<div>'+nodeText+'<div/>');

  var width = boundingBox.width;
  if (width < 40){
    width = 40;
  }

  newDiv.attr('id', 'vpbd-hightlight');
  newDiv.css('width', width);
  newDiv.css('top', offset.top+boundingBox.height);
  newDiv.css('left', offset.left);
  newDiv.css('position', 'absolute');
  newDiv.css('z-index', 1000);
  newDiv.css('background-color', tooltipColor);
  newDiv.css('border', 'solid 1px '+tooltipBorderColor);
  newDiv.css('opacity', .9);
  $(document.body).append(newDiv);
}

function unoutline(event){
  if (currentlyRecording()){
    removeScrapingTooltip();
  }
  if (currentlyScraping()){
    unoutlineTarget(targetFromEvent(event));
  }
}

function unoutlineTarget(target){
  $target = $(target);
  targetString = $target.text(); // is this actually an ok identifier?
  $target.css('background-color', $target.data("stored_background_color"));
  $target.css('outline', $target.data("stored_outline"));
  var index = outlinedNodes.indexOf(target);
  outlinedNodes.splice(index, 1);
}

function unoutlineRemaining(){
  for (var i = 0; i < outlinedNodes.length; i++){
    unoutlineTarget(outlinedNodes[i]);
  }
}

function removeScrapingTooltip(){
  $('#vpbd-hightlight').remove();
}

/**********************************************************************
 * The various node representations we may need
 **********************************************************************/

function nodeToMainpanelNodeRepresentation(node,parameterize){
  if(typeof(parameterize)==='undefined') {parameterize = true;}
  if (node === null){
    return {text: "", xpath: "", frame: SimpleRecord.getFrameId(), parameterize:parameterize};
  }
  return {text: nodeToText(node), xpath: nodeToXPath(node), frame: SimpleRecord.getFrameId(), parameterize: parameterize};
}

function nodeToText(node){
  //var text = node.innerText;
  return getElementText(node);
}

function getElementText(el){
  var text = getElementTextHelper(el);
  if (text == null || text == undefined || text == ""){ // should empty text also be null?
    return null;
  }
  text = text.trim();
  return text;
}

function getElementTextHelper(el) {
    var text = '';
    // Text node (3) or CDATA node (4) - return its text
    if ( (el.nodeType === 3) || (el.nodeType === 4) ) {
        return el.nodeValue.trim();
    // If node is an element (1) and an img, input[type=image], or area element, return its alt text
    }
    else if ( (el.nodeType === 1) && (
            (el.tagName.toLowerCase() == 'img') ||
            (el.tagName.toLowerCase() == 'area') ||
            ((el.tagName.toLowerCase() == 'input') && el.getAttribute('type') && (el.getAttribute('type').toLowerCase() == 'image'))
            ) ) {
        altText = el.getAttribute('alt')
        if (altText == null || altText == undefined){
          altText = ''
        }
        return altText.trim();
        return el.getAttribute('alt').trim() || '';
    }
    // Traverse children unless this is a script or style element
    else if ( (el.nodeType === 1) && !el.tagName.match(/^(script|style)$/i)) {
        var text = "";
        var children = el.childNodes;
        for (var i = 0, l = children.length; i < l; i++) {
            var childClassName = children[i].className;
            if (childClassName != undefined && childClassName.indexOf("tipr_container") > -1){
              continue; // this was added to give the user a tooltip.  shouldn't be in text
            }
            var newText = getElementText(children[i]);
            if (newText == null || newText == undefined){
              newText = "";
            }
            if (newText.length > 0){
              text+=newText+"\n";
            }
        }
        return text;
    }
}


/**********************************************************************
 * Handle scraping interaction
 **********************************************************************/

function currentlyScraping(){
  return additional_recording_handlers_on.scrape;
}

$(function(){
  additional_recording_handlers.scrape = function(node, eventData){
    if (eventData.type !== "click") {return null;} //only care about clicks
    var data = nodeToMainpanelNodeRepresentation(node,false);
    utilities.sendMessage("content", "mainpanel", "scrapedData", data);
    console.log("scrape", data);
    return data;
  };
}); //run once page loaded, because else runs before r+r content script

var mostRecentMousemoveTarget = null;
document.addEventListener('mousemove', updateMousemoveTarget, true);
function updateMousemoveTarget(event){
  mostRecentMousemoveTarget = event.target;
}

// functions for letting the record and replay layer know whether to run the additional handler above
function startProcessingScrape(){
  additional_recording_handlers_on.scrape = true;
  outlineTarget(mostRecentMousemoveTarget);
}

function stopProcessingScrape(){
  additional_recording_handlers_on.scrape = false;
  unoutlineRemaining();
}

function scrapingClick(event){
  if (additional_recording_handlers_on.scrape){
    event.stopPropagation();
    event.preventDefault();
  }
}

function checkScrapingOn(event){
  if (event.ctrlKey && event.altKey){ // convention is we need ctrl+alt+click to scrape
    startProcessingScrape();
  }
}

function checkScrapingOff(event){
  if (currentlyScraping() && !(event.ctrlKey && event.altKey)){ // this is for keyup, so user is exiting the scraping mode
    stopProcessingScrape();
  }
}