// get-ip.js
fetch('https://ifconfig.me')
  .then(res => res.text())
  .then(ip => console.log('\n>>> NODE.JS OUTBOUND IP IS:', ip, '<<<\n'))
  .catch(err => console.log('Failed:', err.message));