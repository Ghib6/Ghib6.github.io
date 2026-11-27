(() => {
    const createTime = Math.round(new Date('2019-04-17 00:00:00').getTime() / 1000);

    const activateBadges = () => {
        const badgeImages = document.querySelectorAll('#ghbdages img[data-lazy-src]');
        badgeImages.forEach(image => {
            image.src = image.getAttribute('data-lazy-src');
            image.removeAttribute('data-lazy-src');
        });
        return badgeImages.length;
    };

    const moveFooterWidgets = () => {
        const footer = document.getElementById('footer');
        const workboard = document.getElementById('workboard');
        const badges = document.getElementById('ghbdages');

        if (!footer) return;

        if (workboard && workboard.parentElement === footer) {
            workboard.style.textAlign = 'center';
            footer.prepend(workboard);
        }

        if (badges && badges.parentElement === footer) {
            badges.style.display = 'block';
            badges.style.textAlign = 'center';
            badges.style.margin = '0.5rem 0 0';
            footer.prepend(badges);
        }
    };

    const renderRuntime = () => {
        const workboard = document.getElementById('workboard');
        if (!workboard) return;

        let timestamp = Math.round(new Date().getTime() / 1000);
        let second = timestamp - createTime;
        const time = [0, 0, 0, 0, 0];

        const pad = value => (value > 9 ? value : `0${value}`);

        if (second >= 365 * 24 * 3600) {
            time[0] = parseInt(second / (365 * 24 * 3600));
            second %= 365 * 24 * 3600;
        }
        if (second >= 24 * 3600) {
            time[1] = parseInt(second / (24 * 3600));
            second %= 24 * 3600;
        }
        if (second >= 3600) {
            time[2] = pad(parseInt(second / 3600));
            second %= 3600;
        }
        if (second >= 60) {
            time[3] = pad(parseInt(second / 60));
            second %= 60;
        }
        if (second > 0) {
            time[4] = pad(second);
        }

        const currentTimeHtml = Number(time[2]) < 22 && Number(time[2]) > 7
            ? "<img class='boardsign' src='https://img.shields.io/badge/糖果屋-营业中-6adea8?style=social&logo=cakephp' title='距离百年老店也就差不到一百年~'><div id='runtime'>" + time[0] + ' YEAR ' + time[1] + ' DAYS ' + time[2] + ' : ' + time[3] + ' : ' + time[4] + '</div>'
            : "<img class='boardsign' src='https://img.shields.io/badge/糖果屋-打烊了-6adea8?style=social&logo=coffeescript' title='这个点了应该去睡觉啦，熬夜对身体不好哦'><div id='runtime'>" + time[0] + ' YEAR ' + time[1] + ' DAYS ' + time[2] + ' : ' + time[3] + ' : ' + time[4] + '</div>';

        workboard.innerHTML = currentTimeHtml;
    };

    const refreshFooter = () => {
        activateBadges();
        moveFooterWidgets();
        renderRuntime();
    };

    refreshFooter();
    document.addEventListener('DOMContentLoaded', refreshFooter);
    window.addEventListener('load', refreshFooter);

    let retryCount = 0;
    const retryTimer = setInterval(() => {
        refreshFooter();
        retryCount += 1;
        if (retryCount >= 20 || document.querySelector('#ghbdages img:not([data-lazy-src])')) {
            clearInterval(retryTimer);
        }
    }, 250);

    setInterval(renderRuntime, 1000);
})();
