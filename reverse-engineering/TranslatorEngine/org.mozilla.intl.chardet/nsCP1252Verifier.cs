namespace org.mozilla.intl.chardet;

public class nsCP1252Verifier : nsVerifier
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

	public nsCP1252Verifier()
	{
		m_cclass = new int[32];
		m_cclass[0] = 572662305;
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
		m_cclass[16] = 572662274;
		m_cclass[17] = 16851234;
		m_cclass[18] = 572662304;
		m_cclass[19] = 285286690;
		m_cclass[20] = 572662306;
		m_cclass[21] = 572662306;
		m_cclass[22] = 572662306;
		m_cclass[23] = 572662306;
		m_cclass[24] = 286331153;
		m_cclass[25] = 286331153;
		m_cclass[26] = 554766609;
		m_cclass[27] = 286331153;
		m_cclass[28] = 286331153;
		m_cclass[29] = 286331153;
		m_cclass[30] = 554766609;
		m_cclass[31] = 286331153;
		m_states = new int[3];
		m_states[0] = 571543601;
		m_states[1] = 340853778;
		m_states[2] = 65;
		m_charset = "windows-1252";
		m_stFactor = 3;
	}

	public override bool isUCS2()
	{
		return false;
	}
}
