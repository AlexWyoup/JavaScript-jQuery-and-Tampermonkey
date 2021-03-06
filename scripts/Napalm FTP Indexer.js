// ==UserScript==
// @name         Napalm FTP Indexer
// @namespace    https://www.searchftps.net/
// @version      1
// @description  Kills ads, makes buttons function as expected, etc.
// @author       Stephen Chapman
// @match        *://*.searchftps.net/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

//-- Eliminate Tampermonkey warnings about not recognizing jQuery
var jQuery = window.jQuery;

//-- Get rid of ad containers for each page as appropriately passed
function noAds(page) {
    switch(page) {
        case 'single':
            jQuery('.well').eq(0).find('table > tbody > tr:last').remove();
            jQuery('ins').remove();
            break;
        case 'search':
            jQuery('#result-main-right, ins').remove();
            break;
        case 'home':
            jQuery('ins').remove();
            break;
        default:
            break;
    }
}

//-- Decode URL
function urlRevealer(data) {
    //-- Find beginning of first instance of decode()
    const start = jQuery(data).text().indexOf("decode('");

    //-- Find end of first instance of decode()
    const end = jQuery(data).text().indexOf(")));");

    //-- Build the string to be decoded; clean up with trim()
    const encodedStr = jQuery(data).text().substr(start + 8, (end - start)).replace("')));", "").trim();

    //-- Decode and return the string (should be the URL)
    //-- Using native JS base64 decode function atob() instead of site's custom decode()
    return atob(encodedStr);
}

//-- AJAX call to get file download URLs from individual results pages
function ajaxCall(obj) {
    //-- Prepare serialized data to be sent
    let str = JSON.stringify(obj.hash).replace(/"/g, '')
    str = `action=content&args=type%3Df%26hash%3D${str}`

    //-- Perform AJAX post call, and when finished, update download buttons with direct file URL
    jQuery.ajax({
        type: 'post',
        url: '/',
        data: str,
    }).done(function(data) {
        //-- Decode and store URL
        const url = urlRevealer(data)

        //-- Add URL to hash object for use now, and possibly later if we want
        Object.assign(obj, {url: `${url}`});

        //-- Get the correct download button to replace href for
        const dlBtn = jQuery('.dn-btn > a').eq([obj.btnNum] - 1);

        //-- Replace download button href with correct URL from hash object
        dlBtn.attr('href', obj.url);
    }).fail(function(data) {
        //-- Log to the console if there was a failure
        console.log("Failed: " + obj);
    });
}

//-- Single file(s) page
function singleResult() {
    //-- Kill ads
    noAds('single');

    //-- Get full contents of <script>
    const data = jQuery('script')

    //-- Call to get decoded url string
    const decodedStr = urlRevealer(data)

    //-- Populate URL text boxes
    jQuery('#content1, #content3').html(decodedStr);

    //-- Reconstruct "Direct Link" button
    jQuery('#content1_a').attr('href', decodedStr);

    //-- Reconstruct "Copy to Clipboard" buttons
    jQuery('#copy-ftp-url, #copy-ftp-url-unencoded').attr('data-clipboard-text', decodedStr);

    //-- Reconstruct DOWNLOAD buttons and hyperlinked filenames
    //-- If only one file result, adjust accordingly
    if (jQuery('.file').length > 1) {
        jQuery("[title='Download now']").each(function() {
            //-- Get the filename
            let fn = jQuery(this).parent().siblings().eq(0).text().trim()

            //-- Append filename to decoded URL
            fn = decodedStr + fn

            //-- Replace button and link hrefs with our constructed URL
            jQuery(this).attr('href', fn);
            jQuery(this).parent().siblings().eq(0).find('a').attr('href', fn);
        })
    } else {
        //-- Replace file link href with our constructed URL
        jQuery('.file > a').attr('href', decodedStr);
    }

    //-- Show and re-link "Directory" hyperlink
    jQuery('.dir > b > a').text(decodedStr).attr('href', decodedStr);
}

//-- Search results pages (with or without results)
function searchResults(files) {
    //-- Kill ads
    noAds('search');

    //-- Correct width of search results container:
    jQuery('#result-main-center').css('width', '100%');

    //-- If no search results on page, return
    if (files == 'noFiles') {
        return;
    }

    //-- Below, get array of hashes from download buttons on page
    //-- and add key/value pair to keep track of which URL belongs
    //-- to which button since AJAX calls happen asyncronously

    //-- Create empty array to store hash objects
    let hashArr = []

    //-- Find all download buttons on the page
    const hashFind = jQuery('.dn-btn > a')

    //-- Create variable to store button count
    let btnCount = 0

    //-- Loop through collection of download buttons, and
    //-- for each one, do stuff
    hashFind.each(function () {
        //-- Increase button count
        btnCount++

        //-- Get hash object from button href
        let hash = jQuery(this).attr('href')

        //-- Find start/end position of object brackets
        const start = hash.indexOf("{")
        const end = hash.indexOf("}")

        //-- Part out hash object from the rest of the element
        hash = hash.slice(start, end+1)

        //-- Replace key/value single quotes with double quotes
        hash = JSON.parse(hash.replace(/'/g, '"'))

        //-- Add button count key/value to hash object for AJAX call
        Object.assign(hash, {btnNum: btnCount});

        //-- Add hash object to the hash array
        hashArr.push(hash);
    });

    //-- Loop through hash array and make AJAX calls accordingly
    for (let i = 0; i < hashArr.length; i++) {
        ajaxCall(hashArr[i]);
    }
}

//-- Home page (just kills ads for now)
function homePage() {
    //-- Kill ads
    noAds('home');
}

//-- Check to see which page is loaded
function start() {
    if (jQuery('.well').length > 0) {
        //-- Specific file(s) result page
        singleResult();
    } else if (jQuery('.similar').length > 0) {
        //-- Search results page with results
        searchResults('yesFiles');
    } else if (jQuery('.alert.alert-block') > 0) {
        //-- Search results page with no results
        searchResults('noFiles');
    } else {
        //-- Home page
        homePage();
    }
}

//-- Once the document state is idle (as defined by @run-at in
//-- the header section of this script), wait half a second to start
setTimeout(function () {
    start();
}, 500);
