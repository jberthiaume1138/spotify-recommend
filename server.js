var unirest = require('unirest');
var express = require('express');
var events = require('events');

var getFromApi = function(endpoint, args) {
    var emitter = new events.EventEmitter();
    unirest.get('https://api.spotify.com/v1/' + endpoint)
           .qs(args)
           .end(function(response) {
                if (response.ok) {
                    emitter.emit('end', response.body);
                }
                else {
                    emitter.emit('error', response.code);
                }
            });
    return emitter;
};

var app = express();
app.use(express.static('public'));

app.get('/search/:name', function(req, res) {
    var searchReq = getFromApi('search', {
        q: req.params.name,
        limit: 1,
        type: 'artist'
    });

    searchReq.on('end', function(item) {
        var artist = item.artists.items[0];

        var endPoint = 'artists/' + item.artists.items[0].id + '/related-artists';

        var searchRelated = getFromApi(endPoint);

        searchRelated.on('end', function(relatedCollection) {
            // item.artists.forEach(function(act){
            //     console.log(act.name);
            // });
            // console.log(item.artists);

            artist.related = relatedCollection.artists;
            var numberOfRelatedArtists = relatedCollection.artists.length;  // usually 20
            var completed = 0;

            artist.related.forEach(function(band) {
                if (completed === numberOfRelatedArtists) {
                    // we are done
                    // return the now fully populated json object
                    res.json(artist);               // key was to move this here
                }
                else {
                    //hit the API for the band's top tracks
                    // var topTracksEndpoint = 'artists/' + artist.related[0].id + '/top-tracks';
                    var topTracksEndpoint = 'artists/' + band.id + '/top-tracks';
                    console.log(topTracksEndpoint);

                    var searchTopTracks = getFromApi(topTracksEndpoint);
                    searchTopTracks.on('end', function(topTracks) {
                        band.tracks = topTracks.tracks;
                    });

                    searchTopTracks.on('error', function(code) {
                        res.sendStatus(404);
                    });

                }

                completed++;
            });
        });

        searchRelated.on('error', function(code) {
            // console.log(code);
            res.sendStatus(404);
        });
    });

    searchReq.on('error', function(code) {
        res.sendStatus(code);
    });
});

app.listen(8080);
