# Reference photo (not a webcam capture)

`overripe-banana.jpg`: 960-pixel Wikimedia preview of [Overripe banana 20211221 152406.jpg](https://commons.wikimedia.org/wiki/File:Overripe_banana_20211221_152406.jpg), by GALAXY 2018 A7, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The image shows one banana with a split peel; it is useful for a conservative block test, not a happy-path freshness-2 example. No edits beyond Wikimedia's preview resize.

Run `node lib/brain/dev-scan.mjs lib/brain/samples/overripe-banana.jpg --base-url http://localhost:3001`.

`freckled-ripe-bananas.jpg`: [Freckled Ripe Bananas](https://www.publicdomainpictures.net/en/view-image.php?image=364955&picture=freckled-ripe-bananas), by Circe Denyer, [CC0 Public Domain](https://creativecommons.org/publicdomain/zero/1.0/). Downloaded unchanged from the free 1920-pixel image. Two intact spotted bananas; used to verify the reference-image happy path, not claimed as a presenter-camera capture.

`node lib/brain/verify-live.mjs lib/brain/samples/freckled-ripe-bananas.jpg --base-url http://localhost:3001 --expect-special banana` resets the local synthetic world, scans the real file, requires non-fixture provenance, verifies the exact published offer and plays until it sells out. This does not copy private presenter photos into the repository.

The mold reference used for development is [Moldy avocado](https://www.flickr.com/photos/cornellfungi/472586100/) by Kathie Hodge / Cornell Fungi, [CC BY-NC-SA 2.0](https://creativecommons.org/licenses/by-nc-sa/2.0/). It was downloaded unchanged into a temporary directory for a local test and is not redistributed here or included in the demo UI.
