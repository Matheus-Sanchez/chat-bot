const os = require('os');

function normalizeFamily(family) {
    return family === 4 ? 'IPv4' : family;
}

function isAnyAddress(host) {
    return !host || host === '0.0.0.0' || host === '::' || host === '[::]';
}

function isLoopbackAddress(host) {
    return host === 'localhost'
        || host === '127.0.0.1'
        || host === '::1'
        || host === '[::1]';
}

function isUsableIpv4(address) {
    return Boolean(address)
        && address !== '0.0.0.0'
        && !address.startsWith('127.')
        && !address.startsWith('169.254.');
}

function formatHostForUrl(host) {
    if (host.includes(':') && !host.startsWith('[')) {
        return `[${host}]`;
    }

    return host;
}

function getNetworkAddresses(interfaces = os.networkInterfaces()) {
    return Object.entries(interfaces)
        .flatMap(([name, entries = []]) => entries
            .filter((entry) => normalizeFamily(entry.family) === 'IPv4')
            .filter((entry) => !entry.internal && isUsableIpv4(entry.address))
            .map((entry) => ({ name, address: entry.address })))
        .sort((left, right) => left.name.localeCompare(right.name) || left.address.localeCompare(right.address));
}

function getServerUrls({ host, port, protocol = 'http', interfaces } = {}) {
    const configuredHost = host || '0.0.0.0';
    const urls = [];

    if (isAnyAddress(configuredHost)) {
        urls.push({ label: 'Local', url: `${protocol}://localhost:${port}` });

        for (const networkAddress of getNetworkAddresses(interfaces)) {
            urls.push({
                label: `Rede (${networkAddress.name})`,
                url: `${protocol}://${networkAddress.address}:${port}`,
            });
        }

        return urls;
    }

    urls.push({
        label: isLoopbackAddress(configuredHost) ? 'Local' : 'Rede',
        url: `${protocol}://${formatHostForUrl(configuredHost)}:${port}`,
    });

    return urls;
}

module.exports = {
    getNetworkAddresses,
    getServerUrls,
    isAnyAddress,
};
