// Module for communicating with the native app
const NativeAppCommunicator = (() => {
    function sendMessageToNativeApp(jsonData) {
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeHandler) {
            window.webkit.messageHandlers.nativeHandler.postMessage(JSON.stringify(jsonData));
        } else if (window.AndroidBridge && window.AndroidBridge.processAction) {
            window.AndroidBridge.processAction(JSON.stringify(jsonData));
        } else {
            console.error("Native interface not available");
        }
    }

    // Expose the sendMessageToNativeApp function directly for use in user scripts
    return {
        sendMessage: sendMessageToNativeApp
    };
})();
