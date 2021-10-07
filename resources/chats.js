// Setup
(() => {
    for (let chat of document.getElementsByClassName('chat')) {
        chat.addEventListener('click', (e) => {
            document.getElementsByClassName('chat--active')[0]?.classList?.remove('chat--active')
            document.getElementsByClassName('viewport')[0].src = chat.dataset.filename
            chat.classList.add('chat--active')
        })
    }
})()
