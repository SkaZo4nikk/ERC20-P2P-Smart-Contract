import { escrowAlphaSol } from "../typechain-types/contracts";
import { loadFixture, ethers, expect } from "./setup";
//Каждое обращение к BlockChain через await
describe("MyToken", function() {
    async function deploy() {
        const [user1, user2, user3, user4, user5] = await ethers.getSigners();

        const Factory1 = await ethers.getContractFactory("PeerToPeerTransaction");
        const myToken = await Factory1.deploy(); 
        await myToken.waitForDeployment();

        const Factory2 = await ethers.getContractFactory("EscrowContract");
        const escrowAlpha = await Factory2.connect(user1).deploy();
        await escrowAlpha.waitForDeployment();

        return {user1, user2, user3, user4, user5, myToken, escrowAlpha}
    }

    it("Should be deployed", async function() {
        const {user1, user2, user3, user4, user5, myToken, escrowAlpha} = await loadFixture(deploy);

        console.log("Адрес смарт-контракта PeerToPeerTransaction:", await myToken.getAddress()); //Получаем адреса
        console.log("Адрес смарт-контракта EscrowContract:", await escrowAlpha.getAddress());
        console.log("Адрес user1:", user1.address);
        console.log("Адрес user2:", user2.address);
        console.log("Адрес user3:", user3.address);
        console.log("Адрес user4:", user4.address);
        console.log("Адрес user5:", user5.address);
    
        expect(myToken.target).to.be.properAddress;
        expect(escrowAlpha.target).to.be.properAddress;
    })

    it("Initial values correct", async function() {
        const {myToken, escrowAlpha, user1} = await loadFixture(deploy);

        //Проверка начальных значений для контракта PeerToPeerTransaction
        expect(await myToken.name()).to.eq("PeerToPeerTransaction");
        expect(await myToken.symbol()).to.eq("PTPT");
        expect(await myToken.decimals()).to.eq(18);
        expect(await myToken.totalSupply()).to.eq(10000000000000000000000n);
        expect(await myToken.tokenPrice()).to.eq(100000000000000);
        expect(await myToken.balanceOf(myToken.target)).to.eq(10000000000000000000000n);
        expect(await ethers.provider.getBalance(myToken.target)).to.eq(0);

        //Проверка адреса владельца контракта EscrowContract
        expect(await escrowAlpha.owner()).to.eq(user1.address);

        //Проверка значений в структуре Deal
        const deal = await escrowAlpha.deals(1);
        expect(deal.garant).to.eq(0x0000000000000000000000000000000000000000n);
        expect(deal.client).to.eq(0x0000000000000000000000000000000000000000n);
        expect(deal.implementer).to.eq(0x0000000000000000000000000000000000000000n);
        expect(deal.token).to.eq(0x0000000000000000000000000000000000000000n);
        expect(deal.transactionAmount).to.eq(0);
        expect(deal.dealCompleted).to.be.false;
        expect(deal.fundsDeposited).to.be.false;
    });

    it("Function buyToken and sellToken correct", async function() {
        const {user1, myToken} = await loadFixture(deploy);

        const amount = 400000000000000; //Величина перевода
        
        //Проверяем начальный баланс контракта
        expect(await ethers.provider.getBalance(myToken.target)).to.eq(0);

        const tx1 = await myToken.connect(user1).buyToken({ value: amount });

        //Проверяем баланс контракта после покупки токенов user1
        expect(await ethers.provider.getBalance(myToken.target)).to.eq(amount);

        //Проверяем баланс токенов у user1
        expect(await myToken.balanceOf(user1)).to.eq(4);

        //Проверяем списались ли средства у user1
        await expect(tx1).to.changeEtherBalance(user1, -amount); 

        const tx2 = await myToken.connect(user1).sellToken(4);

        //Проверяем баланс токенов у user1
        expect(await myToken.balanceOf(user1)).to.eq(0);

        //Проверяем баланс контракта после продажи токенов user1
        expect(await ethers.provider.getBalance(myToken.target)).to.eq(0);

        //Проверяем пополнился ли баланс у user1
        await expect(tx2).to.changeEtherBalance(user1, amount);
    })

    it("Function createDeal correct", async function() {
        const {user1, user2, user3, user4, myToken, escrowAlpha} = await loadFixture(deploy);

        const amount = 400000000000000; //Потрачено wei
        await myToken.connect(user1).buyToken({ value: amount});
        
        const dealid = 1;
        const client = user2.address;
        const implementer = user3.address;
        const token = await myToken.getAddress();
        const transactionAmount = Number(amount) / Number(await myToken.tokenPrice());
        
        await escrowAlpha.connect(user1).createDeal(dealid, client, implementer, token, transactionAmount);

        //Проверка, что только user1 может вызвать функцию createDeal
        await expect(escrowAlpha.connect(user2).createDeal(dealid, client, implementer, token, transactionAmount)).to.be.reverted;
        await expect(escrowAlpha.connect(user3).createDeal(dealid, client, implementer, token, transactionAmount)).to.be.reverted;
        await expect(escrowAlpha.connect(user4).createDeal(dealid, client, implementer, token, transactionAmount)).to.be.reverted;
        
        //Проверка записи сделки в структуру Deal
        const deal = await escrowAlpha.deals(dealid);
        expect(deal.garant).to.eq(user1.address);
        expect(deal.client).to.eq(user2.address);
        expect(deal.implementer).to.eq(user3.address);
        expect(deal.token).to.eq(await myToken.getAddress());
        expect(deal.transactionAmount).to.eq(transactionAmount);
        expect(deal.dealCompleted).to.be.false;
        expect(deal.fundsDeposited).to.be.false;
    })

    it("Function depositTokens and completeDeal correct", async function() {
        const {user1, user2, user3, user4, myToken, escrowAlpha} = await loadFixture(deploy);

        const amount = 400000000000000; //Потрачено wei
        const dealid = 1; //id сделки
        const client = user2.address;
        const implementer = user3.address;
        const token = await myToken.getAddress();
        const transactionAmount = Number(amount) / Number(await myToken.tokenPrice());

        //Проверяем баланс токенов у user1
        expect(await myToken.balanceOf(user1)).to.eq(0);
        await myToken.connect(user1).buyToken({ value: amount});
        //Проверяем баланс токенов у user1
        expect(await myToken.balanceOf(user1)).to.eq(transactionAmount);

        await escrowAlpha.connect(user1).createDeal(dealid, client, implementer, token, transactionAmount);

        //Проверка, что только user1 может вызвать функцию depositTokens
        await expect(escrowAlpha.connect(user2).depositTokens(dealid)).to.be.reverted;
        await expect(escrowAlpha.connect(user3).depositTokens(dealid)).to.be.reverted;
        await expect(escrowAlpha.connect(user4).depositTokens(dealid)).to.be.reverted;

        await myToken.connect(user1).approve(await escrowAlpha.getAddress(), transactionAmount);
        await escrowAlpha.connect(user1).depositTokens(dealid);

        //Проверка баланса токенов гаранта и контракта после внесения депозита 
        expect(await myToken.balanceOf(user1)).to.eq(0);
        expect(await myToken.balanceOf(escrowAlpha.target)).to.eq(transactionAmount);

        //Проверка записи сделки в структуру Deal
        let deal = await escrowAlpha.deals(dealid);
        expect(deal.garant).to.eq(user1.address);
        expect(deal.client).to.eq(user2.address);
        expect(deal.implementer).to.eq(user3.address);
        expect(deal.token).to.eq(await myToken.getAddress());
        expect(deal.transactionAmount).to.eq(transactionAmount);
        expect(deal.dealCompleted).to.be.false;
        expect(deal.fundsDeposited).to.be.true;

        //Проверка, что только user1 может вызвать функцию completeDeal
        await expect(escrowAlpha.connect(user2).completeDeal(dealid)).to.be.reverted;
        await expect(escrowAlpha.connect(user3).completeDeal(dealid)).to.be.reverted;
        await expect(escrowAlpha.connect(user4).completeDeal(dealid)).to.be.reverted;
        
        //console.log("начал", (await escrowAlpha.deals(dealid)).dealCompleted);
        await escrowAlpha.connect(user1).completeDeal(dealid);

        //console.log("после", (await escrowAlpha.deals(dealid)).dealCompleted);

        //Проверка, что исполнителю начисляются токены и баланс контракта уменьшился
        expect(await myToken.balanceOf(escrowAlpha.target)).to.eq(0);
        expect(await myToken.balanceOf(implementer)).to.eq(4);

        deal = await escrowAlpha.deals(dealid);

        //Проверка структуры Deal после завершения сделки
        expect(deal.garant).to.eq(user1.address);
        expect(deal.client).to.eq(user2.address);
        expect(deal.implementer).to.eq(user3.address);
        expect(deal.token).to.eq(await myToken.getAddress());
        expect(deal.transactionAmount).to.eq(transactionAmount);
        expect(deal.dealCompleted).to.be.true;
        expect(deal.fundsDeposited).to.be.true;
    })

    it("Function depositTokens and denyDeal correct", async function() {
        const {user1, user2, user3, user4, myToken, escrowAlpha} = await loadFixture(deploy);

        const amount = 400000000000000; //Потрачено wei
        const dealid = 1; //id сделки
        const client = user2.address;
        const implementer = user3.address;
        const token = await myToken.getAddress();
        const transactionAmount = Number(amount) / Number(await myToken.tokenPrice());

        //Проверяем баланс токенов у user1
        expect(await myToken.balanceOf(user1)).to.eq(0);
        await myToken.connect(user1).buyToken({ value: amount});
        //Проверяем баланс токенов у user1
        expect(await myToken.balanceOf(user1)).to.eq(transactionAmount);

        await escrowAlpha.connect(user1).createDeal(dealid, client, implementer, token, transactionAmount);

        //Проверка, что только user1 может вызвать функцию depositTokens
        await expect(escrowAlpha.connect(user2).depositTokens(dealid)).to.be.reverted;
        await expect(escrowAlpha.connect(user3).depositTokens(dealid)).to.be.reverted;
        await expect(escrowAlpha.connect(user4).depositTokens(dealid)).to.be.reverted;

        await myToken.connect(user1).approve(await escrowAlpha.getAddress(), transactionAmount);
        await escrowAlpha.connect(user1).depositTokens(dealid);

        //Проверка баланса токенов гаранта и контракта после внесения депозита 
        expect(await myToken.balanceOf(user1)).to.eq(0);
        expect(await myToken.balanceOf(escrowAlpha.target)).to.eq(transactionAmount);

        //Проверка записи сделки в структуру Deal
        let deal = await escrowAlpha.deals(dealid);
        expect(deal.garant).to.eq(user1.address);
        expect(deal.client).to.eq(user2.address);
        expect(deal.implementer).to.eq(user3.address);
        expect(deal.token).to.eq(await myToken.getAddress());
        expect(deal.transactionAmount).to.eq(transactionAmount);
        expect(deal.dealCompleted).to.be.false;
        expect(deal.fundsDeposited).to.be.true;

        //Проверка, что только user1 может вызвать функцию denyDeal
        await expect(escrowAlpha.connect(user2).completeDeal(dealid)).to.be.reverted;
        await expect(escrowAlpha.connect(user3).completeDeal(dealid)).to.be.reverted;
        await expect(escrowAlpha.connect(user4).completeDeal(dealid)).to.be.reverted;
        
        await escrowAlpha.connect(user1).denyDeal(dealid);

        //Проверка, что клиенту начисляются токены и баланс контракта уменьшился
        expect(await myToken.balanceOf(escrowAlpha.target)).to.eq(0);
        expect(await myToken.balanceOf(client)).to.eq(4);

        deal = await escrowAlpha.deals(dealid);

        //Проверка структуры Deal после завершения сделки
        expect(deal.garant).to.eq(user1.address);
        expect(deal.client).to.eq(user2.address);
        expect(deal.implementer).to.eq(user3.address);
        expect(deal.token).to.eq(await myToken.getAddress());
        expect(deal.transactionAmount).to.eq(transactionAmount);
        expect(deal.dealCompleted).to.be.true;
        expect(deal.fundsDeposited).to.be.false;
    })

    it("Function depositTokens and finalizeDeal correct", async function() {
        const {user1, user2, user3, user4, myToken, escrowAlpha} = await loadFixture(deploy);

        const amount = 400000000000000; //Потрачено wei
        const dealid = 1; //id сделки
        const client = user2.address;
        const implementer = user3.address;
        const token = await myToken.getAddress();
        const transactionAmount = Number(amount) / Number(await myToken.tokenPrice());

        //Проверяем баланс токенов у user1
        expect(await myToken.balanceOf(user1)).to.eq(0);
        await myToken.connect(user1).buyToken({ value: amount});
        //Проверяем баланс токенов у user1
        expect(await myToken.balanceOf(user1)).to.eq(transactionAmount);

        await escrowAlpha.connect(user1).createDeal(dealid, client, implementer, token, transactionAmount);

        //Проверка, что только user1 может вызвать функцию depositTokens
        await expect(escrowAlpha.connect(user2).depositTokens(dealid)).to.be.reverted;
        await expect(escrowAlpha.connect(user3).depositTokens(dealid)).to.be.reverted;
        await expect(escrowAlpha.connect(user4).depositTokens(dealid)).to.be.reverted;

        await myToken.connect(user1).approve(await escrowAlpha.getAddress(), transactionAmount);
        await escrowAlpha.connect(user1).depositTokens(dealid);

        //Проверка баланса токенов гаранта и контракта после внесения депозита 
        expect(await myToken.balanceOf(user1)).to.eq(0);
        expect(await myToken.balanceOf(escrowAlpha.target)).to.eq(transactionAmount);

        //Проверка записи сделки в структуру Deal
        let deal = await escrowAlpha.deals(dealid);
        expect(deal.garant).to.eq(user1.address);
        expect(deal.client).to.eq(user2.address);
        expect(deal.implementer).to.eq(user3.address);
        expect(deal.token).to.eq(await myToken.getAddress());
        expect(deal.transactionAmount).to.eq(transactionAmount);
        expect(deal.dealCompleted).to.be.false;
        expect(deal.fundsDeposited).to.be.true;

        const implementerPercentage = 25;

        //Проверка, что только user1 может вызвать функцию finalizeDeal
        await expect(escrowAlpha.connect(user2).finalizeDeal(dealid, implementerPercentage)).to.be.reverted;
        await expect(escrowAlpha.connect(user3).finalizeDeal(dealid, implementerPercentage)).to.be.reverted;
        await expect(escrowAlpha.connect(user4).finalizeDeal(dealid, implementerPercentage)).to.be.reverted;
        
        await escrowAlpha.connect(user1).finalizeDeal(dealid, implementerPercentage);

        //Проверка, что клиенту, исполнителю начисляются токены и баланс контракта уменьшился
        expect(await myToken.balanceOf(escrowAlpha.target)).to.eq(0);
        expect(await myToken.balanceOf(client)).to.eq(3);
        expect(await myToken.balanceOf(implementer)).to.eq(1);

        deal = await escrowAlpha.deals(dealid);

        //Проверка структуры Deal после завершения сделки
        expect(deal.garant).to.eq(user1.address);
        expect(deal.client).to.eq(user2.address);
        expect(deal.implementer).to.eq(user3.address);
        expect(deal.token).to.eq(await myToken.getAddress());
        expect(deal.transactionAmount).to.eq(transactionAmount);
        expect(deal.dealCompleted).to.be.true;
        expect(deal.fundsDeposited).to.be.true;
    })
});