namespace org.mozilla.intl.chardet;

public class nsEUCTWVerifier : nsVerifier
{
	private static int[] m_cclass;

	private static int[] m_states;

	private static int m_stFactor;

	private static string m_charset;

	public override int[] cclass()
	{
		return m_cclass;
	}

	public override int[] states()
	{
		return m_states;
	}

	public override int stFactor()
	{
		return m_stFactor;
	}

	public override string charset()
	{
		return m_charset;
	}

	public nsEUCTWVerifier()
	{
		m_cclass = new int[32];
		m_cclass[0] = 572662306;
		m_cclass[1] = 2236962;
		m_cclass[2] = 572662306;
		m_cclass[3] = 572654114;
		m_cclass[4] = 572662306;
		m_cclass[5] = 572662306;
		m_cclass[6] = 572662306;
		m_cclass[7] = 572662306;
		m_cclass[8] = 572662306;
		m_cclass[9] = 572662306;
		m_cclass[10] = 572662306;
		m_cclass[11] = 572662306;
		m_cclass[12] = 572662306;
		m_cclass[13] = 572662306;
		m_cclass[14] = 572662306;
		m_cclass[15] = 572662306;
		m_cclass[16] = 0;
		m_cclass[17] = 100663296;
		m_cclass[18] = 0;
		m_cclass[19] = 0;
		m_cclass[20] = 1145324592;
		m_cclass[21] = 286331221;
		m_cclass[22] = 286331153;
		m_cclass[23] = 286331153;
		m_cclass[24] = 858985233;
		m_cclass[25] = 858993459;
		m_cclass[26] = 858993459;
		m_cclass[27] = 858993459;
		m_cclass[28] = 858993459;
		m_cclass[29] = 858993459;
		m_cclass[30] = 858993459;
		m_cclass[31] = 53687091;
		m_states = new int[6];
		m_states[0] = 338898961;
		m_states[1] = 571543825;
		m_states[2] = 269623842;
		m_states[3] = 286330880;
		m_states[4] = 1052949;
		m_states[5] = 16;
		m_charset = "x-euc-tw";
		m_stFactor = 7;
	}

	public override bool isUCS2()
	{
		return false;
	}
}
