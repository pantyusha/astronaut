/*
    streaming video ids

    ex. videoStream.start(callback);

    receives a video, timestamp at regular intervals
*/

require('./arrayutil');

var csv = require('csv')
  , youtube = require('./youtube');

var CRAWL_ENABLED = true;
var VIDEO_INTERVAL = 8000;
var REFRESH_INTERVAL = 86400000 //one day
var DATA_FILE = __dirname + '/data.txt';
var sendVideoTimer = 0;
var crawlTimer = 0;
var currentVid = {};
var lastRefresh;
var videoCallback;

var adIndex = 0;
// these are the interstitual videos
// var ads = ["Ip2ZGND1I9Q"];
var ads = [];

// enable this play list to bring in playlist videos as ads
// var adPlayListId = 'PL0boS0-jubPp2EZC6tUFJKCaqMHCaOdL9';
var lastAdTime = new Date();
var AD_INTERVAL = 60000 * 3; //time in between ads in milliseconds


function Queue(queueSize) {
  /*
    fixed size queue
    queueSize
    prunes duplicates
    oldest items will be eliminated

    // this could be backed on disk later
  */
  this.queueSize = queueSize;
  this.queue = [];
  this.uniqueItems = {};
  this.index = 0;

  this.itemKey = function(item) {
    return item.id;
  }

  this.add = function(items) {
    var added = [];
    var that = this;
    for (var i=0; i<items.length; i++) {
      var key = this.itemKey(items[i]);
      if (!this.uniqueItems[key]) {
        this.uniqueItems[key] = items[i];
        added.push(items[i]);
      }
    }
    this.queue = this.queue.concat(added);
    this._prune();
  };

  this._prune = function() {
    // removes old videos pass the limit
    var over = this.queue.length - this.queueSize;
    if (over > 0) {
      var removed = this.queue.splice(0, over);
      this.index = this.index - over;
      if (this.index < 0) {
        this.index = 0;
      }
      for (var i=0; i < removed.length; i++) {
        var key = this.itemKey(removed[i]);
        delete this.uniqueItems[key];
      }
    }
  }

  this.next = function() {

    if (this.queue.length == 0) {
      return undefined;
    }

    this.index = this.index % this.queue.length;
    var vid = this.queue[this.index];
    this.index = (this.index + 1) % this.queue.length;
    if (this.index == 0) {
      // shuffle the queue when we loop around
      this.queue.shuffle();
    }
    return vid;
  }

  this.getLength = function() {
    return this.queue.length;
  }
}

var queue = new Queue(10000);

function shouldSendAd() {
  var now = new Date();
  return  (now - lastAdTime) > AD_INTERVAL;
}

function getNextAd() {
  var vid = ads[adIndex];
  adIndex = (adIndex + 1) % ads.length;
  lastAdTime = new Date();
  // we have to match the same format as a normal video
  return {
    id: vid,
    viewCount: 1000,
    uploaded: '2015-01-01T15:29:36Z'
  }
}

function sendVideo() {
  var video, offset;
  if (shouldSendAd()) {
    video = getNextAd();
    offset = 10 + Math.floor( Math.random() * 40 );
  } else {
    video = queue.next();
    offset = 0;
  }

  if (!video) {
    return;
  }

  var data = {
    video: video,
    time: (new Date())/1000,
    offset: offset
  };

  currentVid = data;

  if (videoCallback) {
    videoCallback(currentVid);
  }
}

function loadVideos(vids) {
  if (vids.length) {
    queue.add(vids.shuffle());
    lastRefresh = new Date();
  }
}

function readVideos() {
  var vids = [];
  csv()
  .from.path(DATA_FILE)
  .transform(function(data){
      data.unshift(data.pop());
      return data;
  })
  .on('record',function(data, index){
      vids.push({
          id: data[0],
          uploaded: '2015-07-26T23:36:35.599Z',
          viewCount: 3,
          duration: 400
      });
  })
  .on('end',function(count){
      console.log('Read in', count, 'videos.');
      loadVideos(vids);
  })
  .on('error',function(error){
      console.log(error.message);
  });
}

function getFreshVideos() {
  youtube.getVids({
    tags: ['dsc', 'img', 'mov'],
    startIndex: 3,
    endIndex: 699,
    vidCallback: loadVideos
  });
}

function start(sendVideoCallback) {
    videoCallback = sendVideoCallback;
    if (CRAWL_ENABLED) {
      getFreshVideos();
    } else {
      readVideos();
    }
    clearInterval(crawlTimer);
    crawlTimer = setInterval(getFreshVideos, REFRESH_INTERVAL);
    clearInterval(sendVideoTimer);
    sendVideoTimer = setInterval(sendVideo, VIDEO_INTERVAL);

    // if (adPlayListId) {
    //   youtube.getPlaylist(adPlayListId, function(error, vids) {
    //     console.log('replacing ads', vids);
    //     ads = vids;
    //   });
    // }
}

exports.start = start;

exports.setCrawlEnabled = function(on) {
  CRAWL_ENABLED = on;
};
exports.currentVid = function() {
    return currentVid;
};
exports.lastRefresh = function() {
    return lastRefresh;
};
exports.numVideos = function() {
  return queue.getLength();
};
exports.videos = function() {
  return queue.queue.slice(0, 500);
}
