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
            artist.related = relatedCollection.artists;

            var numberOfRelatedArtists = relatedCollection.artists.length;  // usually 20
            var completed = 0;

            var checkComplete = function() {
                if (completed === numberOfRelatedArtists) {
                    // done - return the now fully populated json object
                    res.json(artist);
                }
            };

            artist.related.forEach(function(relatedArtist) {
                // hit the API for the relatedArtists' top tracks
                var topTracksEndpoint = 'artists/' + relatedArtist.id + '/top-tracks?country=US';

                var searchTopTracks = getFromApi(topTracksEndpoint);

                searchTopTracks.on('end', function(topTracksCollection) {
                    relatedArtist.tracks = topTracksCollection.tracks;
                    completed++;
                    checkComplete();
                });

                searchTopTracks.on('error', function(code) {
                    res.statusCode = 200;
                    console.log('Could not retrieve tracks. Error code: ' + code);
                    completed++;
                    checkComplete();
                });
            });
        });

        searchRelated.on('error', function(code) {
            res.sendStatus(code);
            console.log('Could not retrieve related artists. Error: ' + code);
        });
    });

    searchReq.on('error', function(code) {
        res.sendStatus(code);
    });
});

app.listen(8080);
