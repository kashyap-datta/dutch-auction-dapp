import { useWeb3React } from '@web3-react/core';
import { Contract, ethers, Signer } from 'ethers';
import {
  ChangeEvent,
  MouseEvent,
  ReactElement,
  useEffect,
  useState
} from 'react';
import styled from 'styled-components';
import DutchAuctionArtifact from '../artifacts/contracts/BasicDutchAuction.sol/BasicDutchAuction.json'
import { Provider } from '../utils/provider';
import { SectionDivider } from './SectionDivider';

const StyledDeployContractButton = styled.button`
  width: 180px;
  height: 2rem;
  border-radius: 1rem;
  border-color: blue;
  cursor: pointer;
  place-self: center;
`;


const StyledLabel = styled.label`
  font-weight: bold;
`;

const StyledInput = styled.input`
  padding: 0.4rem 0.6rem;
  line-height: 2fr;
`;

const StyledButton = styled.button`
  width: 150px;
  height: 2rem;
  border-radius: 1rem;
  border-color: blue;
  cursor: pointer;
`;
interface ContractDetails {
  reservePrice: number;
  numBlocksAuctionOpen: number;
  offerPriceDecrement: number;
  currentPrice: number;
  buyer: string;
}

export function Auction(): ReactElement {
  const context = useWeb3React<Provider>();
  const { library, active } = context;
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [signer, setSigner] = useState<Signer>();
  const [inputContractAddress, setinputContractAddress] = useState<string>('');
  const [reservePrice, setReservePrice] = useState<string>('');
  const [numBlocksAuctionOpen, setNumOfBlocks] = useState<string>('');
  const [offerPriceDecrement, setPriceDecrement] = useState<string>('');
  const [contractDetails, setContractDetails] = useState<ContractDetails | null>(null);
  const [contractAddress, setContractAddress] = useState<string>('');
  const [basicDutchAuctionContract, setBasicDutchAuctionContract] = useState<Contract>();
  const [bidAmount, setBidAmount] = useState<string>('');
  const [bidResult, setBidResult] = useState<string>('');

  console.log("ContractDetails:", contractDetails)
  console.log("ContractAddr:", contractAddress)
  const resPrice = contractDetails?.reservePrice;
  const formattedValue = resPrice ? ethers.utils.formatEther(resPrice.toString()) : '<Not Available>';
  console.log("FormattedReservePrice:", formattedValue);

  useEffect((): void => {
    if (!library) {
      setSigner(undefined);
      return;
    }

    setSigner(library.getSigner());
  }, [library]);


  function handleDeployContract(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();

    // only deploy the basicDutchAuctionContract one time, when a signer is defined
    if (basicDutchAuctionContract || !signer) {
      return;
    }

    async function deployDutchAuctionContract(): Promise<void> {
      const DutchAuctionContractFactory = new ethers.ContractFactory(
        DutchAuctionArtifact.abi,
        DutchAuctionArtifact.bytecode,
        signer
      );

      try {
        const DutchAuctionContract = await DutchAuctionContractFactory.deploy(ethers.utils.parseEther(reservePrice), numBlocksAuctionOpen, ethers.utils.parseEther(offerPriceDecrement));

        await DutchAuctionContract.deployed();
        setBasicDutchAuctionContract(DutchAuctionContract);
        setContractAddress(DutchAuctionContract.address);
      } catch (error: any) {
        window.alert(
          'Error!' + (error && error.message ? `\n\n${error.message}` : '')
        );
      }
    }

    deployDutchAuctionContract();
  }
  async function getContractInfo(event: MouseEvent<HTMLButtonElement>): Promise<void> {
    try {
      setIsLoading(true);
      // const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(inputContractAddress, DutchAuctionArtifact.abi, signer);

      const reservePrice = await contract.reservePrice();
      const numBlocksAuctionOpen = await contract.numBlocksAuctionOpen();
      const offerPriceDecrement = await contract.offerPriceDecrement();
      const currentPrice = await contract.getCurrentPrice();
      const auctionStatus = await contract.getCurrentPrice();
      const buyerAddr = await contract.winner();

      setContractDetails({
        reservePrice,
        numBlocksAuctionOpen,
        offerPriceDecrement,
        currentPrice,
        buyer: buyerAddr
      });
    } catch (error) {
      console.error("Error fetching contract details:", error);
      setContractDetails(null);
    }
    finally {
      setIsLoading(false);
    }
  };

  const submitBid = async (): Promise<void> => {
    try {
      const contract = new ethers.Contract(
        inputContractAddress,
        DutchAuctionArtifact.abi,
        signer
      );
      const gasPrice = ethers.utils.parseUnits('20', 'gwei');
      const gasLimit = ethers.BigNumber.from('300000');
      const bidTx = await contract.bid({
        value: ethers.utils.parseEther(bidAmount),
        gasPrice,
        gasLimit,
      });
      console.log(bidTx)

      try {
        await bidTx.wait();
        setBidResult('Bid accepted as the winner');
      } catch (error: any) {
        if (error.code === ethers.utils.Logger.errors.CALL_EXCEPTION) {
          setBidResult('Bid not accepted');
        } else {
          console.error('Error placing bid:', error);
        }
      }
    } catch (error) {
      setBidResult('Bid not accepted');
      console.error('Error placing bid:', error);
    }
  };


  return (
    <>
      <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px' }}>
        <h2>Deployment</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <StyledLabel>Reserve Price</StyledLabel>
          <input type="number"
            value={reservePrice}
            onChange={(e) => setReservePrice(e.target.value)}
            placeholder="Reserve Price" />
          <StyledLabel>Number Of Blocks</StyledLabel>
          <input type="number"
            value={numBlocksAuctionOpen}
            onChange={(e) => setNumOfBlocks(e.target.value)}
            placeholder="Num of Blocks" />
          <StyledLabel>Price Decrement</StyledLabel>
          <input type="number"
            value={offerPriceDecrement}
            onChange={(e) => setPriceDecrement(e.target.value)}
            placeholder="Price Decrement" />
        </div>
        <StyledDeployContractButton
          disabled={!active || basicDutchAuctionContract ? true : false}
          style={{
            cursor: !active || basicDutchAuctionContract ? 'not-allowed' : 'pointer',
            borderColor: !active || basicDutchAuctionContract ? 'unset' : 'blue'
          }}
          onClick={handleDeployContract}
        >
          Deploy Auction Contract
        </StyledDeployContractButton>
        {/* </section> */}
        <div style={{ display: 'flex', gap: '5px' }}>
          <StyledLabel>Contract addr</StyledLabel>
          <div>
            {contractAddress ? (
              contractAddress
            ) : (
              <em>{`<Contract not yet deployed>`}</em>
            )}
          </div>
        </div>
      </section >
      <SectionDivider />
      <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px' }}>
        <h2>Auction Info</h2>
        <StyledLabel>Contract Address</StyledLabel>
        <input placeholder='Enter Address to get info'
          value={inputContractAddress}
          onChange={(event) =>
            setinputContractAddress(event.target.value)
          } />
        <StyledButton onClick={getContractInfo} >Show Info </StyledButton>
        {/* empty placeholder div below to provide empty first row, 3rd col div for a 2x3 grid */}
        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: '50px' }}>
          <StyledLabel>Reserve Price:</StyledLabel>
          <div>
            {contractDetails?.reservePrice ? ethers.utils.formatEther(contractDetails.reservePrice?.toString()) : <em>{`<Not Available>`}</em>}
          </div>
          <StyledLabel>Number of Blocks:</StyledLabel>
          <div>
            {contractDetails?.numBlocksAuctionOpen ? contractDetails.numBlocksAuctionOpen?.toString() : <em>{`<Not Available>`}</em>}
          </div>
          <StyledLabel>Price Decrement:</StyledLabel>
          <div>
            {contractDetails?.offerPriceDecrement ? ethers.utils.formatEther(contractDetails.offerPriceDecrement?.toString()) : <em>{`<Not Available>`}</em>}
          </div>
          <StyledLabel>Current Price:</StyledLabel>
          <div>
            {contractDetails?.reservePrice ? ethers.utils.formatEther(contractDetails.currentPrice?.toString()) : <em>{`<Not Available>`}</em>}
          </div>
          <StyledLabel>Winner:</StyledLabel>
          <div>
            {contractDetails?.buyer.localeCompare(ethers.constants.AddressZero) === 0 ? "No winner yet" : contractDetails?.buyer}
          </div>
        </div>
      </section>
      {/* empty placeholder div below to provide empty first row, 3rd col div for a 2x3 grid */}
      <div></div>
      <SectionDivider />
      <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <h2>Bids</h2>
        <input
          type="number"
          value={bidAmount}
          onChange={(e) => setBidAmount(e.target.value)}
          placeholder="Enter Bid Amount (ETH)"
        />
        <button onClick={submitBid}>Bid</button>
        {bidResult && <div>{bidResult}</div>}
      </section>



    </>
  );
}
